/**
 * Minimal, browser-only .xlsx reader/writer for the PDF Generator's table
 * import. An .xlsx is a ZIP of XML parts, so this reads just what we need
 * with fflate + DOMParser instead of pulling in a full spreadsheet library:
 *
 *   - cell text from the first sheet (shared strings, inline strings, numbers)
 *   - pictures, both kinds Excel produces:
 *       * floating pictures ("Insert > Pictures > Place over Cells"),
 *         matched to the cell their top-left corner is anchored in
 *       * in-cell pictures ("Place in Cell" / =IMAGE), stored as rich values
 *
 * The result is a plain grid (every row, header included, with text and/or
 * a picture per cell); lib/pdfGenerator/tableImport.ts maps it onto a
 * template's fields.
 */
import { strToU8, unzipSync, zipSync } from "fflate";

export interface SheetCell {
  text: string;
  image: Blob | null;
}

/** Rows in sheet order; each row maps 0-based column index -> cell. */
export interface SheetData {
  rows: Map<number, SheetCell>[];
  warnings: string[];
}

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

export async function parseXlsx(file: Blob): Promise<SheetData> {
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
  const floating = new Map<string, Blob>(); // "row:col" -> picture
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
      const colEl = from ? directChildren(from, "col")[0] : null;
      const blip = children(anchor, "blip")[0];
      const embed = blip ? relAttr(blip, "embed") : null;
      if (!rowEl || !embed) continue;
      const key = `${parseInt(rowEl.textContent ?? "", 10)}:${parseInt(colEl?.textContent ?? "0", 10)}`;
      const blob = mediaBlob(drawingRels.get(embed));
      if (blob && !floating.has(key)) floating.set(key, blob);
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

  // 6. Assemble the grid.
  const byRow = new Map<number, Map<number, SheetCell>>();
  const cellAt = (r: number, c: number) => {
    if (!byRow.has(r)) byRow.set(r, new Map());
    const row = byRow.get(r)!;
    if (!row.has(c)) row.set(c, { text: "", image: null });
    return row.get(c)!;
  };
  for (const [r, cols] of grid) for (const [c, text] of cols) cellAt(r, c).text = text;
  for (const [r, cols] of cellPictureVm) {
    for (const [c, vm] of cols) {
      const image = inCellImage(vm);
      if (image) cellAt(r, c).image = image;
    }
  }
  for (const [key, image] of floating) {
    const [r, c] = key.split(":").map(Number);
    const cell = cellAt(r, c);
    cell.image ??= image;
  }

  const warnings: string[] = [];
  if (skippedFormats.size) {
    warnings.push(
      `Some pictures are in a format browsers can't read (${Array.from(skippedFormats).join(", ")}). Re-insert them as PNG or JPG.`
    );
  }
  const rows = Array.from(byRow.keys())
    .sort((x, y) => x - y)
    .map((r) => byRow.get(r)!);
  return { rows, warnings };
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A blank workbook with one bold header per column, to fill in and import back. */
export function buildTemplateXlsx(headers: { label: string; width: number }[]): Uint8Array {
  const cell = (ref: string, value: string, style = 0) =>
    `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${escapeXml(value)}</t></is></c>`;
  const cols = headers
    .map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${h.width}" customWidth="1"/>`)
    .join("");
  const headerCells = headers.map((h, i) => cell(`${colLetter(i)}1`, h.label, 1)).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="60" customHeight="1"/>
<cols>${cols}</cols>
<sheetData><row r="1" ht="20" customHeight="1">${headerCells}</row></sheetData>
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
