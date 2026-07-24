-- Migration: add ClickUp sync tracking to an already-provisioned `requests`
-- table. Run this once in the Supabase SQL Editor for existing projects
-- (schema.sql already includes these columns for fresh installs).

alter table requests
  add column if not exists clickup_sync_status text not null default 'pending';

alter table requests
  drop constraint if exists requests_clickup_sync_status_check;

alter table requests
  add constraint requests_clickup_sync_status_check
  check (clickup_sync_status in ('pending', 'synced', 'failed'));

alter table requests
  add column if not exists clickup_sync_error text;

create index if not exists idx_requests_clickup_sync_status
  on requests(clickup_sync_status);
