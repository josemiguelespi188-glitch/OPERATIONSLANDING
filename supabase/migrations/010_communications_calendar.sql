-- Communications Calendar: a native Operations Hub feature for planning
-- and approving investor communications (the recurring "Section 1 /
-- Section 2 / FAQ of the month" update emails plus one-off comms).
--
-- Deliberately NOT synced to ClickUp — unlike every request type under
-- app/forms, this is an internal admin-only planning tool with no
-- investor-facing form and no ClickUp list behind it. It lives entirely
-- in this app: Supabase for storage, /admin/communications for the UI,
-- the existing admin_users-gated requireAdmin() for access. See
-- CLAUDE.md's "Communications Calendar" section for the full feature
-- writeup (the approval flow, why email sending wasn't built, etc).
--
-- Purely additive: no existing table, column, or row is touched.

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Matches the structure from the comms planning meeting: Section 1
  -- ("Quienes somos"), Section 2 (deadlines/reminders), the monthly FAQ
  -- entry, or a one-off full communication that doesn't fit the
  -- recurring slots.
  section_type text not null default 'section_1'
    check (section_type in ('section_1', 'section_2', 'faq_of_month', 'full_communication')),
  send_date date,
  -- Free text rather than an enum: the real segment list (which funds,
  -- which account types, "exclude Phoenix", "active only"...) is still
  -- being defined and will change more often than a migration should
  -- gate on.
  segment text,
  channel text not null default 'tbd'
    check (channel in ('tribexa', 'mass_email', 'tbd')),
  -- The design itself is never authored in this table (per the comms
  -- meeting: "el mail en si no se escribe dentro de ClickUp/el Hub") —
  -- just a pointer to it, either an external link or an uploaded .html
  -- file (private `communications-html` bucket below).
  html_url text,
  html_file_path text,
  html_file_name text,
  status text not null default 'idea'
    check (status in (
      'idea', 'in_design', 'sent_for_approval', 'changes_requested',
      'approved', 'scheduled', 'sent'
    )),
  compliance_report text,
  -- Only meaningful when section_type = 'faq_of_month'; left null otherwise.
  faq_notes text,
  responsible text,
  approvers text not null default 'Diego, Lana',
  approved_at timestamptz,
  approved_by text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_communications_send_date on communications(send_date);
create index if not exists idx_communications_status on communications(status);

drop trigger if exists trg_communications_updated_at on communications;
create trigger trg_communications_updated_at
  before update on communications
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------
-- communications_status_history: audit trail for the approval flow —
-- who sent something for approval, who approved or requested changes
-- and when, and the comment left on a "changes requested" (mirrors
-- investor_update_status_history's shape/role from migration 005).
-- ---------------------------------------------------------------------
create table if not exists communications_status_history (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_status_history_comm
  on communications_status_history(communication_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security — service-role only, same as pdf_templates: this
-- is an internal admin tool with no public-facing insert path, so
-- unlike `requests`/`investor_feedback` there's no "anyone can insert"
-- policy at all. Every access goes through /api/admin/communications*,
-- which checks requireAdmin() first.
-- ---------------------------------------------------------------------
alter table communications enable row level security;
alter table communications_status_history enable row level security;

-- Private bucket for uploaded HTML designs, same signed-upload-URL
-- pattern as the `pdf-templates` bucket (migration 007): the browser
-- never touches it with its own key, the admin API hands out short-lived
-- signed upload/download URLs instead.
insert into storage.buckets (id, name, public)
values ('communications-html', 'communications-html', false)
on conflict (id) do nothing;
