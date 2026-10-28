/**
 * Shared types for "Generate Document" (admin Form Builder -> a request
 * type's "Generate Document" button). A request type can hold any number
 * of named document mappings (e.g. several different Redemption Request
 * document variants) -- reusing the exact box-placement engine the PDF
 * Generator tool already has (lib/pdfGenerator/types.ts + generatePdf())
 * -- the only real difference is where a field's VALUE comes from: not
 * typed in by an admin, but either pulled live from that request type's
 * ClickUp list by Order Number at generation time (see
 * lib/documentGenerator/clickupFields.ts and resolveFromClickUp.ts), or a
 * fixed literal value the admin typed once (PdfField.fixedValue, shared
 * with the plain PDF Generator tool -- see generatePdf()).
 *
 * A DocumentField is a PdfField (same id/label/type/sample/defaultValue/
 * fixedValue shape) plus clickUpFieldId, so a DocumentTemplateConfig can
 * be passed directly wherever a PdfTemplateConfig is expected --
 * MappingEditor's `config` prop and generatePdf()'s `config` argument
 * both work completely unmodified against it. V1 only ever creates "text"
 * fields (no image fields -- ClickUp custom field values are all text/
 * number/dropdown/checkbox, never an uploadable image), but the type
 * isn't narrowed to enforce that beyond the field picker UI only
 * offering text.
 *
 * Oct 2026 (second follow-up pass): fields are no longer limited to this
 * request type's hand-curated CUSTOM_FIELD_MAP entries -- clickUpFieldId
 * is a real live ClickUp custom field id (from clickupFields.ts's
 * getAllClickUpFields(), which reads the whole list's field catalog
 * directly from ClickUp), not an internal FormSpec key. A field with no
 * clickUpFieldId at all is valid too, as long as it has a fixedValue --
 * that's a fixed-text field with no ClickUp source. This replaced the
 * older `customFieldKey: string` (always required, always an internal
 * FormSpec key) -- a mapping saved before this change needs its ClickUp-
 * sourced fields re-picked from the new field picker (its boxes/labels
 * are unaffected, only the value source).
 */
import type { PdfField, PdfTemplateConfig } from "@/lib/pdfGenerator/types";
import { emptyConfig, sanitizeConfig } from "@/lib/pdfGenerator/types";

export interface DocumentField extends PdfField {
  /** The live ClickUp custom field id this pulls from. Absent for a fixed-text field (see PdfField.fixedValue). */
  clickUpFieldId?: string;
}

export interface DocumentTemplateConfig extends Omit<PdfTemplateConfig, "fields"> {
  fields: DocumentField[];
}

export interface DocumentTemplateSummary {
  id: string;
  requestTypeId: string;
  name: string;
  fileName: string | null;
  pageCount: number | null;
  mapping: DocumentTemplateConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateDetail extends DocumentTemplateSummary {
  /** Short-lived signed URL for the template PDF (null until uploaded). */
  fileUrl: string | null;
}

export function emptyDocumentConfig(): DocumentTemplateConfig {
  return { ...emptyConfig(), fields: [] };
}

/**
 * Same sanitation job as pdfGenerator/types.ts's sanitizeConfig, plus
 * dropping any field with neither a clickUpFieldId nor a fixedValue (and
 * the boxes that pointed at it) -- a document field with no ClickUp
 * source and no fixed text can never resolve a value, so keeping it
 * around would just silently render blank boxes forever instead of
 * surfacing as a mapping problem.
 */
export function sanitizeDocumentConfig(input: unknown): DocumentTemplateConfig {
  if (!input || typeof input !== "object") return emptyDocumentConfig();
  const r = input as Record<string, unknown>;

  const fields: DocumentField[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(r.fields) ? r.fields.slice(0, 50) : []) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const clickUpFieldId = typeof f.clickUpFieldId === "string" ? f.clickUpFieldId.trim() : "";
    const fixedValue = typeof f.fixedValue === "string" ? f.fixedValue.slice(0, 500) : undefined;
    if (!clickUpFieldId && fixedValue === undefined) continue;
    const id = typeof f.id === "string" && f.id ? f.id : `${clickUpFieldId || "fixed"}-${fields.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fields.push({
      id,
      label: typeof f.label === "string" && f.label.trim() ? f.label.trim().slice(0, 100) : clickUpFieldId || "Fixed text",
      type: "text",
      sample: "",
      defaultValue: "",
      clickUpFieldId: clickUpFieldId || undefined,
      fixedValue,
    });
  }

  const boxes = Array.isArray(r.boxes)
    ? r.boxes
        .slice(0, 200)
        .filter((raw) => raw && typeof raw === "object" && seen.has((raw as Record<string, unknown>).fieldId as string))
    : [];

  // Reuse the real box sanitizer (numeric/enum clamping, fieldId
  // whitelisting) via the generic PdfTemplateConfig shape -- a
  // DocumentField already satisfies PdfField structurally.
  const { boxes: sanitizedBoxes } = sanitizeConfig({ fields, boxes, fileNamePattern: "" });

  return {
    version: 2,
    fields,
    boxes: sanitizedBoxes,
    fileNamePattern: typeof r.fileNamePattern === "string" ? r.fileNamePattern.slice(0, 300) : "",
  };
}
