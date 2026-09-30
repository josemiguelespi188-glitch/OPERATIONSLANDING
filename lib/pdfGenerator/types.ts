/**
 * Shared types for the admin PDF Generator (app/admin/pdf-generator).
 * Coordinates are PDF points with a bottom-left origin, i.e. exactly what
 * pdf-lib's drawText/drawImage expect, so no conversion happens at
 * generation time; only the on-screen editor converts to/from pixels.
 */

export type PdfFontName = "Helvetica" | "Helvetica-Bold" | "Times-Roman" | "Times-Bold" | "Courier";
export type PdfTextAlign = "left" | "center" | "right";

export interface PdfPlacementBase {
  id: string;
  page: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextPlacement extends PdfPlacementBase {
  type: "text";
  fontSize: number;
  font: PdfFontName;
  color: string; // #rrggbb
  align: PdfTextAlign;
}

export interface PdfImagePlacement extends PdfPlacementBase {
  type: "image";
}

export type PdfPlacement = PdfTextPlacement | PdfImagePlacement;

export interface PdfTemplateSummary {
  id: string;
  name: string;
  fileName: string | null;
  pageCount: number | null;
  mapping: PdfPlacement[];
  createdAt: string;
  updatedAt: string;
}

export interface PdfTemplateDetail extends PdfTemplateSummary {
  /** Short-lived signed URL for the template PDF (null until uploaded). */
  fileUrl: string | null;
}

export const PDF_FONTS: PdfFontName[] = [
  "Helvetica",
  "Helvetica-Bold",
  "Times-Roman",
  "Times-Bold",
  "Courier",
];

const HEX = /^#[0-9a-fA-F]{6}$/;

function num(value: unknown, fallback: number, min = -1e6, max = 1e6): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Drops anything malformed from a client-supplied mapping (used server-side before saving). */
export function sanitizeMapping(input: unknown): PdfPlacement[] {
  if (!Array.isArray(input)) return [];
  const out: PdfPlacement[] = [];
  for (const raw of input.slice(0, 50)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const base: PdfPlacementBase = {
      id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : Math.random().toString(36).slice(2),
      page: Math.round(num(r.page, 0, 0, 10000)),
      x: num(r.x, 0),
      y: num(r.y, 0),
      width: num(r.width, 100, 1),
      height: num(r.height, 20, 1),
    };
    if (r.type === "text") {
      out.push({
        ...base,
        type: "text",
        fontSize: num(r.fontSize, 18, 4, 300),
        font: PDF_FONTS.includes(r.font as PdfFontName) ? (r.font as PdfFontName) : "Helvetica-Bold",
        color: typeof r.color === "string" && HEX.test(r.color) ? r.color : "#000000",
        align: r.align === "left" || r.align === "right" ? r.align : "center",
      });
    } else if (r.type === "image") {
      out.push({ ...base, type: "image" });
    }
  }
  return out;
}
