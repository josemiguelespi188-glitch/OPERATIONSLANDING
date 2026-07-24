-- AxisKey Operations Hub — core schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- request_types: catalog of the operational processes shown on the hub
-- ---------------------------------------------------------------------
create table if not exists request_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- users: internal team members (no auth yet — populated for future
-- login + activity attribution)
-- ---------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  role text not null default 'staff',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- requests: every submitted process request
-- ---------------------------------------------------------------------
create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid references request_types(id),
  request_type_slug text not null,
  requestor_name text not null,
  requestor_email text not null,
  investor_name text,
  deal_name text,
  notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'completed')),
  payload jsonb not null default '{}'::jsonb,
  clickup_task_id text,
  clickup_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requests_status on requests(status);
create index if not exists idx_requests_type on requests(request_type_slug);
create index if not exists idx_requests_created_at on requests(created_at desc);

-- ---------------------------------------------------------------------
-- request_attachments: files uploaded against a request
-- ---------------------------------------------------------------------
create table if not exists request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_request on request_attachments(request_id);

-- ---------------------------------------------------------------------
-- activity_log: audit trail per request (status changes, sync events)
-- ---------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) on delete cascade,
  action text not null,
  actor_email text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_request on activity_log(request_id);

-- ---------------------------------------------------------------------
-- updated_at trigger for requests
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_requests_updated_at on requests;
create trigger trg_requests_updated_at
  before update on requests
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- No authentication yet, so policies stay intentionally permissive:
-- anyone with the anon key can create a request/attachment, and the
-- service role (used only server-side, in API routes) has full access
-- for admin reads/writes. Tighten `using`/`with check` once internal
-- auth ships.
-- ---------------------------------------------------------------------
alter table request_types enable row level security;
alter table requests enable row level security;
alter table request_attachments enable row level security;
alter table activity_log enable row level security;
alter table users enable row level security;

drop policy if exists "request_types are publicly readable" on request_types;
create policy "request_types are publicly readable"
  on request_types for select
  using (true);

drop policy if exists "anyone can submit a request" on requests;
create policy "anyone can submit a request"
  on requests for insert
  with check (true);

drop policy if exists "anyone can attach files to their request" on request_attachments;
create policy "anyone can attach files to their request"
  on request_attachments for insert
  with check (true);

-- Service role bypasses RLS automatically; no explicit policy needed for
-- the API routes that read/aggregate requests for the Admin panel.

-- ---------------------------------------------------------------------
-- Storage: allow anon uploads to the public `attachments` bucket
-- (bucket itself is created in seed.sql)
-- ---------------------------------------------------------------------
drop policy if exists "anyone can upload attachments" on storage.objects;
create policy "anyone can upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments');

drop policy if exists "attachments are publicly readable" on storage.objects;
create policy "attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'attachments');
