/**
 * Shared types for the admin PDF Generator (app/admin/pdf-generator).
 *
 * A template's config (stored as JSON in `pdf_templates.mapping`) is:
 *   - fields: the variable data each generated PDF gets (text or image),
 *     named by the admin ("Company name", "Logo", "Amount", ...). Each
 *     field becomes one column of the generation table / Excel sheet.
 *   - boxes: where a field is drawn. A field can have any number of boxes
 *     (e.g. the company name on the cover and in the footer).
 *   - fileNamePattern: default output file name, with {Field label} tokens.
 *
 * Box coordinates are PDF points with a bottom-left origin, i.e. exactly
 * what pdf-lib's drawText/drawImage expect, so no conversion happens at
 * generation time; only the on-screen editor converts to/from pixels.
 */

export type PdfFieldType = "text" | "image";
export type PdfFontFamily = "Helvetica" | "Times" | "Courier";
export type PdfHAlign = "left" | "center" | "right";
export type PdfVAlign = "top" | "middle" | "bottom";
export type PdfImageFit = "contain" | "stretch";

export interface PdfField {
  id: string;
  label: string;
  type: PdfFieldType;
  /** Text used for the editor preview (text fields only). */
  sample: string;
  /** Used when a row leaves this field empty (text fields only). */
  defaultValue: string;
}

export interface PdfBox {
  id: string;
  fieldId: string;
  page: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
  align: PdfHAlign;
  vAlign: PdfVAlign;
  // Text style (ignored for image fields)
  fontFamily: PdfFontFamily;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: string; // #rrggbb
  autoShrink: boolean;
  multiline: boolean;
  lineHeight: number;
  uppercase: boolean;
  // Image style (ignored for text fields)
  fit: PdfImageFit;
  opacity: number; // 0..1
}

export interface PdfTemplateConfig {
  version: 2;
  fields: PdfField[];
  boxes: PdfBox[];
  fileNamePattern: string;
}

export interface PdfTemplateSummary {
  id: string;
  name: string;
  fileName: string | null;
  pageCount: number | null;
  mapping: PdfTemplateConfig;
  createdAt: string;
  updatedAt: string;
}

export interface PdfTemplateDetail extends PdfTemplateSummary {
  /** Short-lived signed URL for the template PDF (null until uploaded). */
  fileUrl: string | null;
}

export const PDF_FONT_FAMILIES: PdfFontFamily[] = ["Helvetica", "Times", "Courier"];

export const BOX_DEFAULTS: Omit<PdfBox, "id" | "fieldId" | "page" | "x" | "y" | "width" | "height"> = {
  align: "center",
  vAlign: "middle",
  fontFamily: "Helvetica",
  bold: true,
  italic: false,
  fontSize: 24,
  color: "#000000",
  autoShrink: true,
  multiline: false,
  lineHeight: 1.2,
  uppercase: false,
  fit: "contain",
  opacity: 1,
};

export function emptyConfig(): PdfTemplateConfig {
  return { version: 2, fields: [], boxes: [], fileNamePattern: "" };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Output file name for one row: explicit name, else the pattern with {Field} tokens filled in. */
export function resolveFileName(
  config: PdfTemplateConfig,
  explicit: string,
  textValue: (field: PdfField) => string,
  fallback: string
): string {
  if (explicit.trim()) return explicit.trim();
  const pattern = config.fileNamePattern.trim() || (config.fields.find((f) => f.type === "text") ? `{${config.fields.find((f) => f.type === "text")!.label}}` : "");
  const byLabel = new Map(config.fields.map((f) => [f.label.trim().toLowerCase(), f]));
  const filled = pattern
    .replace(/\{([^}]+)\}/g, (_, label: string) => {
      const field = byLabel.get(label.trim().toLowerCase());
      return field && field.type === "text" ? textValue(field) : "";
    })
    .replace(/\s+/g, " ")
    .replace(/^[\s\-_,.]+|[\s\-_,.]+$/g, "")
    .trim();
  return filled || fallback;
}

// ---------------------------------------------------------------------------
// Sanitizing (server-side before saving, and when reading older rows)
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;

function num(value: unknown, fallback: number, min = -1e6, max = 1e6): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback = "", max = 500): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function sanitizeBox(r: Record<string, unknown>, fieldId: string): PdfBox {
  return {
    id: str(r.id, "", 64) || newId(),
    fieldId,
    page: Math.round(num(r.page, 0, 0, 10000)),
    x: num(r.x, 0),
    y: num(r.y, 0),
    width: num(r.width, 100, 1),
    height: num(r.height, 20, 1),
    align: oneOf(r.align, ["left", "center", "right"] as const, BOX_DEFAULTS.align),
    vAlign: oneOf(r.vAlign, ["top", "middle", "bottom"] as const, BOX_DEFAULTS.vAlign),
    fontFamily: oneOf(r.fontFamily, PDF_FONT_FAMILIES, BOX_DEFAULTS.fontFamily),
    bold: typeof r.bold === "boolean" ? r.bold : BOX_DEFAULTS.bold,
    italic: typeof r.italic === "boolean" ? r.italic : BOX_DEFAULTS.italic,
    fontSize: num(r.fontSize, BOX_DEFAULTS.fontSize, 4, 300),
    color: typeof r.color === "string" && HEX.test(r.color) ? r.color : BOX_DEFAULTS.color,
    autoShrink: typeof r.autoShrink === "boolean" ? r.autoShrink : BOX_DEFAULTS.autoShrink,
    multiline: typeof r.multiline === "boolean" ? r.multiline : BOX_DEFAULTS.multiline,
    lineHeight: num(r.lineHeight, BOX_DEFAULTS.lineHeight, 0.8, 3),
    uppercase: typeof r.uppercase === "boolean" ? r.uppercase : BOX_DEFAULTS.uppercase,
    fit: oneOf(r.fit, ["contain", "stretch"] as const, BOX_DEFAULTS.fit),
    opacity: num(r.opacity, BOX_DEFAULTS.opacity, 0, 1),
  };
}

/** v1 fonts were a single name ("Helvetica-Bold", "Times-Roman", ...). */
function legacyFont(font: unknown): Pick<PdfBox, "fontFamily" | "bold"> {
  const f = typeof font === "string" ? font : "Helvetica-Bold";
  return {
    fontFamily: f.startsWith("Times") ? "Times" : f.startsWith("Courier") ? "Courier" : "Helvetica",
    bold: f.endsWith("Bold"),
  };
}

/**
 * Accepts the current config shape, or the original v1 shape (a bare
 * array of text/image boxes, one implicit "Name" and one "Image" field).
 */
export function sanitizeConfig(input: unknown): PdfTemplateConfig {
  if (Array.isArray(input)) {
    const fields: PdfField[] = [];
    const boxes: PdfBox[] = [];
    const nameField: PdfField = { id: "name", label: "Name", type: "text", sample: "Sample Name", defaultValue: "" };
    const imageField: PdfField = { id: "image", label: "Image", type: "image", sample: "", defaultValue: "" };
    for (const raw of input.slice(0, 200)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      if (r.type === "text") {
        if (!fields.includes(nameField)) fields.push(nameField);
        boxes.push(sanitizeBox({ ...r, ...legacyFont(r.font) }, nameField.id));
      } else if (r.type === "image") {
        if (!fields.includes(imageField)) fields.push(imageField);
        boxes.push(sanitizeBox(r, imageField.id));
      }
    }
    return { version: 2, fields, boxes, fileNamePattern: "" };
  }

  if (!input || typeof input !== "object") return emptyConfig();
  const r = input as Record<string, unknown>;
  const fields: PdfField[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(r.fields) ? r.fields.slice(0, 50) : []) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const id = str(f.id, "", 64) || newId();
    if (seen.has(id)) continue;
    seen.add(id);
    fields.push({
      id,
      label: str(f.label, "", 100).trim() || `Field ${fields.length + 1}`,
      type: f.type === "image" ? "image" : "text",
      sample: str(f.sample, "", 300),
      defaultValue: str(f.defaultValue, "", 300),
    });
  }
  const boxes: PdfBox[] = [];
  for (const raw of Array.isArray(r.boxes) ? r.boxes.slice(0, 200) : []) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    if (typeof b.fieldId !== "string" || !seen.has(b.fieldId)) continue;
    boxes.push(sanitizeBox(b, b.fieldId));
  }
  return { version: 2, fields, boxes, fileNamePattern: str(r.fileNamePattern, "", 300) };
}
