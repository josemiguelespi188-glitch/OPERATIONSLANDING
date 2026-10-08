-- Approvers: a reusable, admin-managed list of (name, email) -- replaces
-- the hardcoded "Diego"/"Lana" picker with real people you can add to
-- over time, same pattern as the `clients` table (migration 013).
create table if not exists approvers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Which specific approver the CURRENT pending_approval cycle was sent
-- to -- a snapshot (name/email as text, not a foreign key) so it still
-- reads correctly even if that approver is later edited or removed
-- from the `approvers` list. Set when "Send for approval" is clicked
-- with a chosen approver; cleared implicitly by just being overwritten
-- on the next request.
alter table communications add column if not exists requested_approver_name text;
alter table communications add column if not exists requested_approver_email text;

-- Comments: free-text notes on a communication, separate from the
-- status-change audit trail (communications_status_history, migration
-- 010) -- shown together as one merged timeline on the detail page's
-- Comments panel, per explicit instruction.
create table if not exists communication_comments (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communication_comments_comm
  on communication_comments(communication_id, created_at desc);

-- Service-role only, same as the rest of this feature's tables.
alter table approvers enable row level security;
alter table communication_comments enable row level security;
