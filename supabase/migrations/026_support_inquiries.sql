-- Support Inquiry's own record of what it has submitted (Oct 2026). Until
-- now this feature had no Supabase table at all -- the self-addressed
-- email WAS the record (see CLAUDE.md's "Support Inquiry" section). The
-- admin asked for a "previous tickets" panel next to the form showing
-- what's already been submitted and its live Zendesk status, which needs
-- Operation Hub to remember which Zendesk ticket a given submission
-- became (the email-to-ticket automation creates it asynchronously, with
-- no id handed back to this app), so this table is now that record.
--
-- owner_email is a placeholder for a "whose list is this" column ahead of
-- real per-coworker login on /support-inquiry (that page still has no
-- auth guard, per explicit design) -- every row is stamped with the same
-- shared value, 'ir@axiskey.com', for now. Once login lands here, this
-- should hold the signed-in coworker's own email instead, and the list
-- endpoint should filter by it accordingly -- built this way from day one
-- per explicit instruction ("hagamos el desarrollo por usuarios de una
-- vez").
create table if not exists support_inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null default 'ir@axiskey.com',
  investor_name text not null,
  investor_email text not null,
  phone text,
  subject text not null,
  detail text not null,
  submitted_at timestamptz not null default now(),
  -- Resolved after the fact by searching Zendesk for a ticket from this
  -- requester created around submitted_at -- null until that search
  -- succeeds (the email-to-ticket automation isn't instant).
  zendesk_ticket_id bigint,
  -- Cached from the last successful live Zendesk read, purely for display
  -- when a fresh read fails -- never the source of truth.
  zendesk_status text,
  status_page_url text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table support_inquiries enable row level security;
-- No policies: service-role only, same strictness as order_tracking_links
-- and every other admin-only table in this app -- /support-inquiry itself
-- has no login, but it only ever reaches this table through the
-- service-role client in app/api/support-inquiry/*, never a direct
-- browser insert.

create index if not exists idx_support_inquiries_owner_email
  on support_inquiries(owner_email, submitted_at desc);
