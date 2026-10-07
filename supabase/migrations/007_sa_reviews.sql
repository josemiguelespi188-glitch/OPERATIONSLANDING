-- Subscription Agreement (SA) mapping-readiness review tool, Admin Center
-- only. Lets an admin upload an SA .docx, runs it through the 9-category
-- mapping-readiness checklist (see CLAUDE.md's "SA Review" section and
-- lib/services/saReview/checklist.ts), and stores the resulting report.
-- Purely additive -- a new table + storage bucket, no existing schema is
-- touched.

create table if not exists sa_reviews (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  original_file_path text not null,
  formatted_file_path text,
  status text not null default 'analyzing' check (status in ('analyzing', 'completed', 'failed')),
  mapping_ready boolean,
  -- Array of { category: number, label: string, status: "ok"|"auto_fix"|"flag",
  -- detail: string, recommendedAction?: string }. One row per SA review is
  -- cheap and low-volume (an internal admin tool, not a public table), so a
  -- jsonb column is simpler here than a child table.
  findings jsonb not null default '[]'::jsonb,
  -- Array of { category: 1|2, targetText: string, action: "widen_blank"|
  -- "left_align", note?: string } -- Claude's specific, locatable instances
  -- for the category 1/2 auto-fixes above. Stored separately from
  -- `findings` so the "Format Document" step can re-run just this list
  -- against the original file without re-calling Claude.
  mechanical_fixes jsonb not null default '[]'::jsonb,
  error text,
  reviewed_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sa_reviews_created_at on sa_reviews(created_at desc);

create or replace function set_sa_reviews_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sa_reviews_updated_at on sa_reviews;
create trigger trg_sa_reviews_updated_at
  before update on sa_reviews
  for each row execute function set_sa_reviews_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Deliberately as strict as order_tracking_links: RLS enabled with NO
-- policies at all, so this table is only ever readable/writable through
-- the service-role client, used exclusively by /api/admin/sa-review/*
-- (all requireAdmin-gated). SA documents can contain investor SSNs,
-- addresses, and signatures, so this is internal admin data, not
-- something any public or anon-key policy should ever touch.
-- ---------------------------------------------------------------------
alter table sa_reviews enable row level security;

-- Private storage bucket for the uploaded original and auto-fixed .docx
-- files. Unlike the public "attachments" bucket (seed.sql), this is NOT
-- public -- files are only ever served through signed URLs generated
-- server-side by the service-role client, never a public URL.
insert into storage.buckets (id, name, public)
values ('sa-reviews', 'sa-reviews', false)
on conflict (id) do nothing;
