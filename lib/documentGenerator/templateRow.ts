import type { DocumentTemplateSummary } from "./types";
import { sanitizeDocumentConfig } from "./types";

/** Private bucket created by supabase/migrations/019_request_document_templates.sql. */
export const DOCUMENT_TEMPLATE_BUCKET = "request-document-templates";

export interface DocumentTemplateRow {
  id: string;
  request_type_id: string;
  file_path: string | null;
  file_name: string | null;
  page_count: number | null;
  mapping: unknown;
  created_at: string;
  updated_at: string;
}

export function toDocumentTemplateSummary(row: DocumentTemplateRow): DocumentTemplateSummary {
  return {
    id: row.id,
    requestTypeId: row.request_type_id,
    fileName: row.file_name,
    pageCount: row.page_count,
    mapping: sanitizeDocumentConfig(row.mapping),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
