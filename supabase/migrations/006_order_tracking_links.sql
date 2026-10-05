-- Maps a secure random token (used in the investor-facing order tracking
-- link) to a ClickUp task id on the "Payment Received Orders" list. Purely
-- additive -- a new table, no existing schema is touched.
--
-- Deliberately stricter than every other table in this app: RLS is
-- enabled with NO policies at all, so it is readable and writable only
-- via the service role client (used by the clickup-order-tracking webhook
-- to create rows, and by GET /api/order-tracking/[token] to look one up).
-- The token must never be guessable from a ClickUp task id or anything
-- else public, so there is no public insert/select policy here, unlike
-- `requests` or `investor_feedback`.

create table if not exists order_tracking_links (
  id uuid primary key default gen_random_uuid(),
  clickup_task_id text not null unique,
  clickup_list_id text not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create index if not exists idx_order_tracking_links_token
  on order_tracking_links(token);

alter table order_tracking_links enable row level security;
