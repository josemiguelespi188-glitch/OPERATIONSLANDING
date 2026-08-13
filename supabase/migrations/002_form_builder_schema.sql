-- Form Builder / Admin Portal schema — Phase 1 + 2.
--
-- This is purely additive: it extends `request_types` with new nullable
-- columns and adds new tables for a future database-driven form builder.
-- It never touches `requests`, `request_attachments`, or `activity_log` —
-- those keep serving the 3 existing hardcoded forms (IRA Funding, Title
-- Transfer, Redemption) exactly as they do today.
--
-- Run this in the Supabase SQL editor after schema.sql / 001_*.sql.

-- ---------------------------------------------------------------------
-- request_types: extend with card/home-page + form-builder metadata.
-- is_locked marks the 3 rows backing the hardcoded forms so the future
-- Form Builder UI can refuse to edit/delete them.
-- uses_dynamic_form marks rows rendered by the future DB-driven form
-- renderer, as opposed to a hardcoded Next.js page.
-- ---------------------------------------------------------------------
alter table request_types add column if not exists icon text;
alter table request_types add column if not exists button_label text not null default 'Open Request';
alter table request_types add column if not exists is_locked boolean not null default false;
alter table request_types add column if not exists uses_dynamic_form boolean not null default false;

-- ---------------------------------------------------------------------
-- admin_users: profile/role row for each Supabase Auth user allowed into
-- /admin. Auth itself (password, sessions) lives in Supabase's own
-- auth.users — this table only holds app-level role/status metadata and
-- is what request.requireAdmin() checks on every admin API call.
-- ---------------------------------------------------------------------
create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- request_fields: field definitions for a database-driven request type.
-- Only used by request_types rows with uses_dynamic_form = true.
-- ---------------------------------------------------------------------
create table if not exists request_fields (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references request_types(id) on delete cascade,
  field_key text not null,
  field_type text not null check (field_type in (
    'short_text', 'long_text', 'email', 'phone', 'number', 'currency', 'date',
    'dropdown', 'multi_select', 'checkbox', 'radio', 'file_upload',
    'section_divider', 'instructions', 'readonly_info'
  )),
  label text not null,
  description text,
  placeholder text,
  help_text text,
  example_text text,
  is_required boolean not null default false,
  default_value text,
  validation_rules jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  column_span text not null default 'half' check (column_span in ('half', 'full')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_type_id, field_key)
);

create index if not exists idx_request_fields_type on request_fields(request_type_id, display_order);

drop trigger if exists trg_request_fields_updated_at on request_fields;
create trigger trg_request_fields_updated_at
  before update on request_fields
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- request_field_options: options for dropdown / multi_select / radio
-- fields.
-- ---------------------------------------------------------------------
create table if not exists request_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references request_fields(id) on delete cascade,
  label text not null,
  value text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_field_options_field on request_field_options(field_id, display_order);

-- ---------------------------------------------------------------------
-- request_submissions / request_submission_files: submissions for
-- database-driven request types (uses_dynamic_form = true). Parallel to,
-- and independent from, the legacy `requests` / `request_attachments`
-- tables used by the 3 hardcoded forms.
-- ---------------------------------------------------------------------
create table if not exists request_submissions (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references request_types(id),
  submitted_by_email text,
  values jsonb not null default '{}'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'completed')),
  clickup_task_id text,
  clickup_synced_at timestamptz,
  clickup_sync_status text not null default 'pending'
    check (clickup_sync_status in ('pending', 'synced', 'failed')),
  clickup_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_request_submissions_type on request_submissions(request_type_id);
create index if not exists idx_request_submissions_created_at on request_submissions(created_at desc);

drop trigger if exists trg_request_submissions_updated_at on request_submissions;
create trigger trg_request_submissions_updated_at
  before update on request_submissions
  for each row
  execute function set_updated_at();

create table if not exists request_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references request_submissions(id) on delete cascade,
  field_key text not null,
  file_name text not null,
  file_url text not null,
  file_size integer,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_submission_files_submission on request_submission_files(submission_id);

-- ---------------------------------------------------------------------
-- clickup_mappings: per-request-type ClickUp sync configuration for
-- database-driven request types.
-- ---------------------------------------------------------------------
create table if not exists clickup_mappings (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null unique references request_types(id) on delete cascade,
  clickup_list_id text,
  clickup_folder_id text,
  task_name_template text,
  task_description_template text,
  default_assignee_id text,
  default_priority text check (default_priority in ('urgent', 'high', 'normal', 'low')),
  tags text[] not null default '{}',
  field_id_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clickup_mappings_updated_at on clickup_mappings;
create trigger trg_clickup_mappings_updated_at
  before update on clickup_mappings
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- form_versions: published-snapshot history per request type, for a
-- future preview/rollback workflow in the Form Builder.
-- ---------------------------------------------------------------------
create table if not exists form_versions (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references request_types(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  published_by uuid references admin_users(id),
  created_at timestamptz not null default now(),
  unique (request_type_id, version_number)
);

create index if not exists idx_form_versions_type on form_versions(request_type_id, version_number desc);

-- ---------------------------------------------------------------------
-- form_activity_log: audit trail for Form Builder changes (distinct from
-- the existing `activity_log`, which tracks per-request events).
-- ---------------------------------------------------------------------
create table if not exists form_activity_log (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid references request_types(id) on delete cascade,
  actor_id uuid references admin_users(id),
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_form_activity_log_type on form_activity_log(request_type_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- All of these are admin-only surfaces — no anon policies, so only the
-- service role (used server-side in API routes) can read/write. The two
-- submission tables get an anon insert-only policy mirroring `requests` /
-- `request_attachments`, ready for when a dynamic form goes live publicly.
-- ---------------------------------------------------------------------
alter table admin_users enable row level security;
alter table request_fields enable row level security;
alter table request_field_options enable row level security;
alter table request_submissions enable row level security;
alter table request_submission_files enable row level security;
alter table clickup_mappings enable row level security;
alter table form_versions enable row level security;
alter table form_activity_log enable row level security;

drop policy if exists "anyone can submit to a dynamic request type" on request_submissions;
create policy "anyone can submit to a dynamic request type"
  on request_submissions for insert
  with check (true);

drop policy if exists "anyone can attach files to their dynamic submission" on request_submission_files;
create policy "anyone can attach files to their dynamic submission"
  on request_submission_files for insert
  with check (true);

drop policy if exists "published field definitions are publicly readable" on request_fields;
create policy "published field definitions are publicly readable"
  on request_fields for select
  using (true);

drop policy if exists "published field options are publicly readable" on request_field_options;
create policy "published field options are publicly readable"
  on request_field_options for select
  using (true);
