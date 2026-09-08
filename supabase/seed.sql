-- Seed the request_types catalog. Safe to re-run.
-- is_locked = true means the row is backed by a code-driven page under
-- app/forms/<slug> (not database-driven — uses_dynamic_form stays false
-- for every row here), so the future Form Builder UI must refuse to
-- edit/delete it. Every current request type has a dedicated page.
--
-- custom-request was removed from the Operations Hub — delete it outright
-- rather than leaving a dead row (requests.request_type_slug is a plain
-- text column, not a foreign key, so this can't break historical rows).
delete from request_types where slug = 'custom-request';

insert into request_types (slug, name, description, sort_order, is_locked) values
  ('title-transfer-request', 'Title Transfer Request', 'A title transfer moves an existing investment order from one investor account to another without changing the investment itself. The amount and terms stay exactly the same; only the account holding the order is updated in AxisKey''s internal system and portal.', 1, true),
  ('redemption-request', 'Redemption Request', 'A redemption withdraws all or part of an investor''s capital from an active investment, whether the full balance or a partial amount. Submitting this form starts the redemption process and may change the investment''s amount or terms going forward.', 2, true),
  ('ira-funding-request', 'IRA Funding Request', 'This request asks AxisKey to reach out to an investor''s IRA custodian to release funds for a specific investment. The client or Capital Raiser completes this form to start that funding process.', 3, true),
  ('refund-request', 'Refund Request', 'A refund returns funds to an investor for a payment made in error, an overpayment, or a canceled order, without affecting any other active investment. This applies before a Subscription Agreement is signed; the client or Capital Raiser completes this form to initiate it.', 4, true),
  ('side-letter-request', 'Side Letter Request', 'A side letter is a supplemental agreement between an investor and an issuer that adds or modifies terms from the original Subscription Agreement, such as bonus payments or adjusted returns. The client or Capital Raiser completes this form to request one be drafted.', 5, true),
  ('investor-information-update', 'Investor Information Update', 'Use this request to update an investor''s personal or account information already on file, such as name, address, phone number, or entity details. The client or Capital Raiser completes this form to initiate the update.', 6, true),
  ('account-maintenance-request', 'Account Maintenance Request', 'An account maintenance request covers corrections or adjustments to an investor''s account or order, such as data entry errors, allocation corrections, or status fixes. It''s for changes outside a standard information update; the client or Capital Raiser completes this form to initiate the correction.', 7, true),
  ('document-request', 'Investor Documentation Request', 'Use this request to ask an investor for outstanding or updated KYC and due diligence documentation needed to complete or maintain their account. The client or Capital Raiser completes this form to initiate the request.', 8, true),
  ('axiskey-report-request', 'Request an AxisKey Report', 'This request generates a report from AxisKey covering investors, orders, or overall account activity. Reports aren''t limited to one investor: they can be pulled at the client, offering, or platform-wide level.', 9, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_locked = excluded.is_locked;

-- Create a public storage bucket for request attachments.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Admin Portal users.
--
-- Supabase Auth accounts (email + password) can't be created from SQL —
-- add them first in the Supabase Dashboard: Authentication > Users >
-- Add user, for each of:
--   ir@axiskey.com       / AxisKey@2026!
--   ir.admin@axiskey.com / AxisOps@2026!
-- (check "Auto Confirm User" so they can sign in immediately). Then run
-- the block below to link them into admin_users — safe to re-run.
-- ---------------------------------------------------------------------
insert into admin_users (id, email, full_name, role)
select id, email, 'IR Team', 'admin'
from auth.users
where email in ('ir@axiskey.com', 'ir.admin@axiskey.com')
on conflict (id) do update set
  email = excluded.email,
  is_active = true;
