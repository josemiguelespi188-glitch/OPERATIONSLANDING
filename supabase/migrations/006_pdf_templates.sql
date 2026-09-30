-- PDF Generator (admin-only tool, unrelated to the Operations Hub request
-- flow — it just lives in the same app/repo/Supabase project).
--
-- An admin uploads a base PDF once, maps where the "name" text and the
-- "logo" image go (one or more boxes each, on any page), and later bulk
-- generates one PDF per (name, logo) pair. Generation happens entirely
-- in the browser (pdf-lib), so only the template itself is stored here:
-- the generated PDFs and the uploaded logos are never persisted.
--
-- Purely additive: no existing table, column, or row is touched.

create table if not exists pdf_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Path inside the private `pdf-templates` storage bucket.
  file_path text,
  file_name text,
  page_count integer,
  -- Array of placement boxes, in PDF points with a bottom-left origin
  -- (pdf-lib's coordinate system):
  --   { id, type: 'text' | 'image', page (0-based), x, y, width, height,
  --     fontSize?, font?, color?, align? }
  -- Every 'text' box gets the same name; every 'image' box the same logo.
  mapping jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pdf_templates_updated_at
  on pdf_templates(updated_at desc);

-- Service-role only: RLS on with no policies, so the anon key can't read
-- or write it. Every access goes through /api/admin/pdf-templates, which
-- checks requireAdmin() first.
alter table pdf_templates enable row level security;

-- Private bucket for the template PDFs. The browser never touches it
-- directly with its own key: the admin API hands out short-lived signed
-- upload/download URLs instead.
insert into storage.buckets (id, name, public)
values ('pdf-templates', 'pdf-templates', false)
on conflict (id) do nothing;
