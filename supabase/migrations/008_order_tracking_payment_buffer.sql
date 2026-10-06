-- A 4-hour buffer before a payment ClickUp just flagged as "received" is
-- shown to the investor as fully "Payment received: Complete" on
-- /order-tracking/[token] -- avoids telling an investor their payment is
-- confirmed only to have to walk it back if ops has to correct/reverse
-- the checkbox shortly after. During the buffer, the step shows
-- "Processing" instead (see lib/orderTracking.ts).
--
-- Purely additive: a new nullable column on the existing table, written
-- by GET /api/order-tracking/[token] the first time it observes payment
-- as received for a given order (and cleared if ops unflags it, so a
-- later real receipt starts its own fresh buffer).

alter table order_tracking_links
  add column if not exists payment_first_seen_received_at timestamptz;
