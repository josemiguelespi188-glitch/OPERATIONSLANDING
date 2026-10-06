-- Maps the identifier used in the investor-facing order tracking link
-- (the `token` column) to a ClickUp task id on the "Payment Received
-- Orders" list. Purely additive -- a new table, no existing schema is
-- touched.
--
-- `token` was originally a cryptographically random value. As of Oct
-- 2026 it holds the ClickUp task's own order number instead (see
-- app/api/webhooks/clickup-order-tracking/route.ts) -- an explicit
-- product decision made after being warned this makes the link
-- guessable/enumerable (order numbers are not secret or high-entropy).
-- The column is still just `text unique`, so no schema change was
-- needed for that switch.
--
-- Deliberately stricter than every other table in this app: RLS is
-- enabled with NO policies at all, so it is readable and writable only
-- via the service role client (used by the clickup-order-tracking webhook
-- to create rows, and by GET /api/order-tracking/[token] to look one up).
-- There is no public insert/select policy here, unlike `requests` or
-- `investor_feedback`.

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
