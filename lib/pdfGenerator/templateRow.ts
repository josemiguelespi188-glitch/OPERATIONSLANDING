import type { PdfTemplateSummary } from "./types";
import { sanitizeConfig } from "./types";

/** Private bucket created by supabase/migrations/007_pdf_templates.sql. */
export const PDF_TEMPLATE_BUCKET = "pdf-templates";

export interface PdfTemplateRow {
  id: string;
  name: string;
  file_path: string | null;
  file_name: string | null;
  page_count: number | null;
  mapping: unknown;
  created_at: string;
  updated_at: string;
}

export function toTemplateSummary(row: PdfTemplateRow): PdfTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    fileName: row.file_name,
    pageCount: row.page_count,
    mapping: sanitizeConfig(row.mapping),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
