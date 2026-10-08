-- A fresh, high-entropy token generated every time "Send for approval"
-- is clicked -- the approval-request email links to
-- /communications-review/<token> instead of the admin UI, so the
-- approver (who may not even have an admin login) lands directly on a
-- focused, chrome-free review screen for just this one communication,
-- per explicit instruction ("no que pueda ir back, solamente es como
-- que literalmente pueda abrir y que se abra el comunicado"). Unlike
-- order_tracking_links' deliberately-guessable token (an order number,
-- read-only), this one gates a WRITE action (approve / request
-- changes), so it's a real random secret, not something derived from
-- visible data.
--
-- Not cleared on approve/reject -- GET /api/communications-review/[id]
-- already refuses once the communication's status has moved off
-- "pending_approval", so a stale token naturally stops working without
-- needing a separate expiry column.
alter table communications add column if not exists review_token text;

create unique index if not exists idx_communications_review_token
  on communications(review_token) where review_token is not null;
