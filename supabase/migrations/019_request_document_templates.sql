-- "Generate Document" (admin Form Builder -> a request type's row ->
-- "Generate Document" button). One document mapping per request type,
-- persisted independently of any one generation: an admin uploads a base
-- PDF once, places fields sourced from that request type's already-
-- confirmed ClickUp custom fields (see CUSTOM_FIELD_MAP in
-- lib/integrations/clickup.ts), and that mapping stays saved forever.
-- Generating a document later searches the request type's ClickUp list
-- for a task matching an Order Number, pulls that task's live (reviewed)
-- data, and fills the PDF with it -- no data from this table is ever
-- mutated by a generation, only read.
--
-- Deliberately its own table, not a new column on pdf_templates: that
-- table is a freeform, admin-named list of unrelated templates (the
-- existing PDF Generator tool), while this is exactly one row per
-- request_types row, with no name of its own (it's always "this type's
-- document"). mapping reuses the exact PdfTemplateConfig JSON shape
-- (fields/boxes/fileNamePattern) from lib/pdfGenerator/types.ts, with
-- each text field also carrying a customFieldKey tying it to one of that
-- request type's known ClickUp custom fields -- see
-- lib/documentGenerator/types.ts.
create table if not exists request_document_templates (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null unique references request_types(id) on delete cascade,
  file_path text,
  file_name text,
  page_count integer,
  mapping jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Service-role only: RLS on with no policies, same strictness as
-- pdf_templates -- every access goes through requireAdmin()-gated routes
-- under /api/admin/request-types/[id]/document-template*.
alter table request_document_templates enable row level security;

-- Private bucket for the base PDFs. Same signed-upload/signed-download
-- URL pattern as pdf-templates: the browser never touches it with its
-- own key.
insert into storage.buckets (id, name, public)
values ('request-document-templates', 'request-document-templates', false)
on conflict (id) do nothing;
