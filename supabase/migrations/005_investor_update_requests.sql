-- Investor Update Request — a new, standalone request type deliberately
-- kept OUT of the shared `requests`/`request_types` tables every other
-- request type uses. Its future roadmap (AI-generated drafts, templates,
-- an approval workflow, version history, direct publication to investor
-- portals) needs a richer status model and structured per-field storage
-- that the generic `requests` schema (payload as one JSON blob, a 3-value
-- status enum) isn't built for — so this gets its own tables now, sized
-- to grow without a rebuild, rather than forcing it into the generic
-- shape and migrating away from it later.
--
-- Purely additive: no existing table, column, or row is touched.

create table if not exists investor_update_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  requester_email text not null,
  offering_name text not null,
  main_update text not null,
  -- "Would you like AxisKey to supplement the update with industry and
  -- market insights?" — stored as the literal Yes/No the form submits,
  -- not a boolean, so a future third option doesn't need a column type
  -- change.
  industry_research_option text not null default 'Yes'
    check (industry_research_option in ('Yes', 'No')),
  additional_notes text,
  -- Only "submitted" is actually used today (the API always inserts that
  -- default) — the rest of the check list is the future workflow from the
  -- spec, allowed now so the column never needs a migration to support it
  -- later, even though nothing in this codebase sets those values yet.
  status text not null default 'submitted'
    check (status in (
      'submitted', 'in_progress', 'draft_created', 'pending_client_approval',
      'approved', 'published', 'completed'
    )),
  clickup_task_id text,
  clickup_synced_at timestamptz,
  clickup_sync_status text not null default 'pending'
    check (clickup_sync_status in ('pending', 'synced', 'failed')),
  clickup_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_investor_update_requests_status
  on investor_update_requests(status);
create index if not exists idx_investor_update_requests_created_at
  on investor_update_requests(created_at desc);

drop trigger if exists trg_investor_update_requests_updated_at on investor_update_requests;
create trigger trg_investor_update_requests_updated_at
  before update on investor_update_requests
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- investor_update_files: every uploaded file, tagged by which of the
-- form's two upload fields it came from — kept separate from
-- request_attachments (used by the generic `requests` table) since this
-- request type doesn't use that table at all.
-- ---------------------------------------------------------------------
create table if not exists investor_update_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references investor_update_requests(id) on delete cascade,
  category text not null check (category in ('supporting_material', 'image_chart')),
  file_name text not null,
  file_url text not null,
  file_size integer,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_investor_update_files_request
  on investor_update_files(request_id);

-- ---------------------------------------------------------------------
-- investor_update_status_history: audit trail for the future status
-- workflow. Nothing writes to this yet beyond the initial "submitted"
-- row the API inserts on creation — this just makes sure the table
-- (and the shape a future status-change endpoint would write) exists
-- ahead of time.
-- ---------------------------------------------------------------------
create table if not exists investor_update_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references investor_update_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_investor_update_status_history_request
  on investor_update_status_history(request_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Same permissive-insert / service-role-only-read pattern as `requests`
-- and `investor_feedback`: the public form is unauthenticated, so anyone
-- with the anon key can insert (in practice only POST
-- /api/investor-update-requests ever does, using the service role key).
-- No select policy on any of the three — reads only work via the service
-- role, used server-side by GET /api/admin/investor-update-requests.
-- ---------------------------------------------------------------------
alter table investor_update_requests enable row level security;
alter table investor_update_files enable row level security;
alter table investor_update_status_history enable row level security;

drop policy if exists "anyone can submit an investor update request" on investor_update_requests;
create policy "anyone can submit an investor update request"
  on investor_update_requests for insert
  with check (true);

drop policy if exists "anyone can attach files to their investor update request" on investor_update_files;
create policy "anyone can attach files to their investor update request"
  on investor_update_files for insert
  with check (true);
