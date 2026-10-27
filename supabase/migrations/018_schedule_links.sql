-- One-time "Schedule a Call" links, generated on demand from the admin
-- Overview page (a button, not a form) so a single Calendly booking link
-- can be shared once and stop working after it's used.
--
-- There is no Calendly API/webhook involved here (no CALENDLY_API_TOKEN
-- exists anywhere in this codebase, and the user explicitly chose not to
-- set one up) -- "used" is detected entirely client-side, by listening
-- for the `calendly.event_scheduled` postMessage the embedded widget
-- already fires in the browser when a booking completes, then calling
-- our own API to flip `used_at`. This is a best-effort signal, not a
-- server-verified booking confirmation: someone who disabled JS or
-- intercepted the request before it reached our API could in theory
-- dodge it. For the intended use (sharing a link with one client) this
-- is enough; don't present `used_at` as proof a meeting was actually
-- booked.
create table if not exists schedule_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

-- Service-role only, same strictness as order_tracking_links and the
-- communications review_token flow -- no public RLS policies at all.
alter table schedule_links enable row level security;
