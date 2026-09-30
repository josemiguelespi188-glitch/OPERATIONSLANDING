/**
 * Minimal, browser-only .xlsx reader/writer for the PDF Generator's table
 * import. An .xlsx is a ZIP of XML parts, so this reads just what we need
 * with fflate + DOMParser instead of pulling in a full spreadsheet library:
 *
 *   - cell text from the first sheet (shared strings, inline strings, numbers)
 *   - pictures, both kinds Excel produces:
 *       * floating pictures ("Insert > Pictures > Place over Cells"),
 *         matched to the row their top-left corner is anchored in
 *       * in-cell pictures ("Place in Cell" / =IMAGE), stored as rich values
 *
 * Each data row becomes { name, logoRef, image } where logoRef is the text
 * of a "Logo"/"File" column (a file name to match against bulk-uploaded
 * logos) and image is a picture found on that row, if any.
 */
import { strToU8, unzipSync, zipSync } from "fflate";

export interface ImportedRow {
  name: string;
  logoRef: string | null;
  image: Blob | null;
}

export interface ImportResult {
  rows: ImportedRow[];
  warnings: string[];
}

const NAME_HEADER = /^(name|nombre|company|compa[nñ]ia|empresa|client|cliente|investor|inversionista)/i;
const LOGO_HEADER = /(logo|image|imagen|foto|photo|picture|file|archivo)/i;

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

function children(el: Element | Document, localName: string): Element[] {
  return Array.from(el.getElementsByTagName("*")).filter((e) => e.localName === localName);
}

function directChildren(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((e) => e.localName === localName);
}

/** r:id / r:embed style attributes, whatever prefix the file used. */
function relAttr(el: Element, localName: string): string | null {
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === localName && attr.name.includes(":")) return attr.value;
  }
  return null;
}

/** Resolve a relationship Target against the directory of the part that owns the .rels file. */
function resolvePath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function dirOf(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}

function relsPathFor(partPath: string) {
  const dir = dirOf(partPath);
  const file = partPath.slice(partPath.lastIndexOf("/") + 1);
  return `${dir ? `${dir}/` : ""}_rels/${file}.rels`;
}

/** Column letters -> 0-based index ("A" -> 0, "AB" -> 27). */
function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function rowIndex(ref: string): number {
  return parseInt(ref.replace(/[A-Z]/gi, ""), 10) - 1;
}

export async function parseXlsx(file: Blob): Promise<ImportResult> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const text = (path: string) => (files[path] ? new TextDecoder().decode(files[path]) : null);
  const xml = (path: string) => {
    const t = text(path);
    return t ? new DOMParser().parseFromString(t, "application/xml") : null;
  };
  const rels = (partPath: string): Map<string, string> => {
    const doc = xml(relsPathFor(partPath));
    const map = new Map<string, string>();
    if (!doc) return map;
    for (const r of children(doc, "Relationship")) {
      const id = r.getAttribute("Id");
      const target = r.getAttribute("Target");
      if (id && target && r.getAttribute("TargetMode") !== "External") {
        map.set(id, resolvePath(dirOf(partPath), target));
      }
    }
    return map;
  };
  const warnings: string[] = [];
  const skippedFormats = new Set<string>();
  const mediaBlob = (path: string | undefined): Blob | null => {
    if (!path || !files[path]) return null;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      skippedFormats.add(ext.toUpperCase());
      return null;
    }
    return new Blob([files[path] as BlobPart], { type: mime });
  };

  // 1. First worksheet.
  const workbook = xml("xl/workbook.xml");
  if (!workbook) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const firstSheet = children(workbook, "sheet")[0];
  const sheetRelId = firstSheet ? relAttr(firstSheet, "id") : null;
  const sheetPath = (sheetRelId && rels("xl/workbook.xml").get(sheetRelId)) || "xl/worksheets/sheet1.xml";
  const sheet = xml(sheetPath);
  if (!sheet) throw new Error("Could not read the first sheet of this Excel file.");

  // 2. Shared strings.
  const shared: string[] = [];
  const sst = xml("xl/sharedStrings.xml");
  if (sst) {
    for (const si of children(sst, "si")) {
      shared.push(children(si, "t").map((t) => t.textContent ?? "").join(""));
    }
  }

  // 3. Cells.
  const grid = new Map<number, Map<number, string>>();
  const cellPictureVm = new Map<number, Map<number, number>>(); // row -> col -> vm (1-based)
  for (const c of children(sheet, "c")) {
    const ref = c.getAttribute("r");
    if (!ref) continue;
    const r = rowIndex(ref);
    const col = colIndex(ref);
    const type = c.getAttribute("t");
    const vm = c.getAttribute("vm");
    if (vm) {
      if (!cellPictureVm.has(r)) cellPictureVm.set(r, new Map());
      cellPictureVm.get(r)!.set(col, parseInt(vm, 10));
    }
    let value = "";
    if (type === "s") value = shared[parseInt(directChildren(c, "v")[0]?.textContent ?? "", 10)] ?? "";
    else if (type === "inlineStr") value = children(c, "t").map((t) => t.textContent ?? "").join("");
    else if (type !== "e") value = directChildren(c, "v")[0]?.textContent ?? "";
    value = value.trim();
    if (!value) continue;
    if (!grid.has(r)) grid.set(r, new Map());
    grid.get(r)!.set(col, value);
  }

  // 4. Floating pictures anchored over cells.
  const floatingByRow = new Map<number, Blob>();
  const sheetRels = rels(sheetPath);
  for (const drawingEl of children(sheet, "drawing")) {
    const drawingId = relAttr(drawingEl, "id");
    const drawingPath = drawingId ? sheetRels.get(drawingId) : undefined;
    const drawing = drawingPath ? xml(drawingPath) : null;
    if (!drawing || !drawingPath) continue;
    const drawingRels = rels(drawingPath);
    for (const anchor of [...children(drawing, "twoCellAnchor"), ...children(drawing, "oneCellAnchor")]) {
      const from = directChildren(anchor, "from")[0];
      const rowEl = from ? directChildren(from, "row")[0] : null;
      const blip = children(anchor, "blip")[0];
      const embed = blip ? relAttr(blip, "embed") : null;
      if (!rowEl || !embed) continue;
      const r = parseInt(rowEl.textContent ?? "", 10);
      const blob = mediaBlob(drawingRels.get(embed));
      if (blob && !floatingByRow.has(r)) floatingByRow.set(r, blob);
    }
  }

  // 5. In-cell pictures (rich values): cell vm -> metadata -> rich value -> relationship -> media.
  const inCellImage = (() => {
    const metadata = xml("xl/metadata.xml");
    const richValues = xml("xl/richData/rdrichvalue.xml");
    const relList = xml("xl/richData/richValueRel.xml");
    if (!metadata || !richValues || !relList) return () => null;

    const valueBks = children(children(metadata, "valueMetadata")[0] ?? metadata, "bk");
    const futureBks = children(
      children(metadata, "futureMetadata").find((f) => f.getAttribute("name") === "XLRICHVALUE") ?? metadata,
      "bk"
    );
    const rvs = children(richValues, "rv");
    const structures = xml("xl/richData/rdrichvaluestructure.xml");
    const structureKeys = structures
      ? children(structures, "s").map((s) => children(s, "k").map((k) => k.getAttribute("n") ?? ""))
      : [];
    const relIds = children(relList, "rel").map((r) => relAttr(r, "id"));
    const relTargets = rels("xl/richData/richValueRel.xml");

    return (vm: number): Blob | null => {
      const rc = children(valueBks[vm - 1] ?? metadata, "rc")[0];
      const futureIdx = rc ? parseInt(rc.getAttribute("v") ?? "", 10) : vm - 1;
      const rvb = children(futureBks[futureIdx] ?? metadata, "rvb")[0];
      const rvIdx = rvb ? parseInt(rvb.getAttribute("i") ?? "", 10) : futureIdx;
      const rv = rvs[rvIdx];
      if (!rv) return null;
      const keys = structureKeys[parseInt(rv.getAttribute("s") ?? "0", 10)] ?? [];
      const keyPos = Math.max(0, keys.indexOf("_rvRel:LocalImageIdentifier"));
      const relIdx = parseInt(directChildren(rv, "v")[keyPos]?.textContent ?? "", 10);
      const relId = relIds[relIdx];
      return relId ? mediaBlob(relTargets.get(relId)) : null;
    };
  })();

  // 6. Header row + columns.
  const rowNumbers = Array.from(new Set([...grid.keys(), ...floatingByRow.keys(), ...cellPictureVm.keys()])).sort(
    (a, b) => a - b
  );
  if (!rowNumbers.length) return { rows: [], warnings: ["The first sheet is empty."] };

  const headerRow = rowNumbers.find((r) => grid.has(r));
  const header = headerRow !== undefined ? grid.get(headerRow)! : new Map<number, string>();
  let nameCol = -1;
  let logoCol = -1;
  for (const [col, value] of header) {
    if (nameCol === -1 && NAME_HEADER.test(value)) nameCol = col;
    else if (logoCol === -1 && LOGO_HEADER.test(value)) logoCol = col;
  }
  const hasHeader = nameCol !== -1 || logoCol !== -1;
  if (nameCol === -1) {
    // No recognizable header: the first column holding text is the name.
    const textCols = new Set<number>();
    for (const r of rowNumbers) for (const col of grid.get(r)?.keys() ?? []) if (col !== logoCol) textCols.add(col);
    nameCol = textCols.size ? Math.min(...textCols) : 0;
  }

  // 7. Data rows.
  const rows: ImportedRow[] = [];
  for (const r of rowNumbers) {
    if (hasHeader && headerRow !== undefined && r <= headerRow) continue;
    const cells = grid.get(r);
    const name = cells?.get(nameCol) ?? "";
    const logoText = logoCol !== -1 ? cells?.get(logoCol) ?? null : null;

    let image: Blob | null = null;
    const vms = cellPictureVm.get(r);
    if (vms) {
      const vm = (logoCol !== -1 && vms.get(logoCol)) || vms.values().next().value;
      if (vm) image = inCellImage(vm);
    }
    image ??= floatingByRow.get(r) ?? null;

    if (!name && !image && !logoText) continue;
    rows.push({ name, logoRef: logoText, image });
  }

  if (skippedFormats.size) {
    warnings.push(
      `Some pictures are in a format browsers can't read (${Array.from(skippedFormats).join(", ")}). Re-insert them as PNG or JPG.`
    );
  }
  return { rows, warnings };
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A blank two-column (Name, Logo) workbook to fill in and import back. */
export function buildTemplateXlsx(): Uint8Array {
  const cell = (ref: string, value: string, style = 0) =>
    `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${escapeXml(value)}</t></is></c>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="60" customHeight="1"/>
<cols><col min="1" max="1" width="45" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/></cols>
<sheetData><row r="1" ht="20" customHeight="1">${cell("A1", "Name", 1)}${cell("B1", "Logo", 1)}</row></sheetData>
</worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="PDFs" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/styles.xml": strToU8(styles),
  });
}
