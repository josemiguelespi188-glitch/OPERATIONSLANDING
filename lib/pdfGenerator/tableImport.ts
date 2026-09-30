/**
 * Maps an imported sheet (Excel grid, CSV, or text pasted from a
 * spreadsheet) onto a template's fields: one row per document, a text
 * value per text field, and per image field either a picture that came
 * with the sheet or a file name to match later against uploaded images.
 */
import type { PdfField } from "./types";
import type { SheetCell } from "./xlsx";

export interface ImportedRow {
  docName: string;
  text: Record<string, string>;
  images: Record<string, Blob | null>;
  /** Image field id -> file name written in its cell (no picture found). */
  refs: Record<string, string>;
}

export const DOC_NAME_LABEL = "Document name";
const DOC_NAME_HEADER = /^(document ?name|doc ?name|file ?name|filename|nombre (del )?(documento|archivo)|documento|archivo)$/;

export function normalizeLabel(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Splits CSV / TSV text into rows of cells, honoring quotes. Delimiter is auto-detected unless given. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim =
    delimiter ??
    (firstLine.includes("\t")
      ? "\t"
      : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
        ? ";"
        : ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function textRowsToSheet(rows: string[][]): Map<number, SheetCell>[] {
  return rows.map((r) => new Map(r.map((text, c) => [c, { text: text.trim(), image: null }])));
}

export function mapSheetToFields(
  sheet: Map<number, SheetCell>[],
  fields: PdfField[]
): { rows: ImportedRow[]; matched: string[]; ignored: string[] } {
  if (!sheet.length) return { rows: [], matched: [], ignored: [] };

  // Header row: the first row, if any of its cells names a field or the document name.
  const byLabel = new Map(fields.map((f) => [normalizeLabel(f.label), f]));
  const header = sheet[0];
  const columns = new Map<number, PdfField | "doc">();
  const ignored: string[] = [];
  for (const [col, cell] of header) {
    const key = normalizeLabel(cell.text);
    if (!key) continue;
    const field = byLabel.get(key);
    if (field && ![...columns.values()].includes(field)) columns.set(col, field);
    else if (DOC_NAME_HEADER.test(key) && ![...columns.values()].includes("doc")) columns.set(col, "doc");
    else ignored.push(cell.text);
  }
  // Second pass: a header that contains a field's name (or vice versa), e.g.
  // "Offering Name" for a field called "Name", when that's the only candidate.
  for (const [col, cell] of header) {
    const key = normalizeLabel(cell.text);
    if (!key || columns.has(col) || DOC_NAME_HEADER.test(key)) continue;
    const taken = new Set(columns.values());
    const words = (s: string) => ` ${s} `;
    const candidates = fields.filter((f) => {
      const label = normalizeLabel(f.label);
      return !taken.has(f) && label && (words(key).includes(words(label)) || words(label).includes(words(key)));
    });
    if (candidates.length === 1) {
      columns.set(col, candidates[0]);
      ignored.splice(ignored.indexOf(cell.text), 1);
    }
  }
  const hasHeader = columns.size > 0;
  if (!hasHeader) {
    // No recognizable header: columns follow the template's field order.
    fields.forEach((f, i) => columns.set(i, f));
    ignored.length = 0;
  }

  const imageFields = fields.filter((f) => f.type === "image");
  const rows: ImportedRow[] = [];
  for (const cells of hasHeader ? sheet.slice(1) : sheet) {
    const row: ImportedRow = { docName: "", text: {}, images: {}, refs: {} };
    let hasData = false;
    const used = new Set<number>();
    for (const [col, target] of columns) {
      const cell = cells.get(col);
      if (!cell) continue;
      used.add(col);
      if (target === "doc") row.docName = cell.text;
      else if (target.type === "text") row.text[target.id] = cell.text;
      else if (cell.image) row.images[target.id] = cell.image;
      else if (cell.text) row.refs[target.id] = cell.text;
      if (cell.text || cell.image) hasData = true;
    }
    // Pictures dropped slightly outside their column still belong to the row.
    for (const [col, cell] of cells) {
      if (used.has(col) || !cell.image) continue;
      const free = imageFields.find((f) => !row.images[f.id] && !row.refs[f.id]);
      if (free) {
        row.images[free.id] = cell.image;
        hasData = true;
      }
    }
    if (hasData) rows.push(row);
  }

  const matched = hasHeader
    ? [...columns.values()].map((t) => (t === "doc" ? DOC_NAME_LABEL : t.label))
    : fields.map((f) => f.label);
  return { rows, matched, ignored };
}
