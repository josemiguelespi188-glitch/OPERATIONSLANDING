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
  ('title-transfer-request', 'Title Transfer Request', 'Submit a title transfer request.', 1, true),
  ('redemption-request', 'Redemption Request', 'Submit an investor redemption request.', 2, true),
  ('ira-funding-request', 'IRA Funding Request', 'Request funds from an IRA custodian.', 3, true),
  ('refund-request', 'Refund Request', 'Request a refund of an investor payment made in error.', 4, true),
  ('side-letter-request', 'Side Letter Request', 'Request the creation of a side letter for an investor.', 5, true),
  ('investor-information-update', 'Investor Information Update', 'Request updates to investor records.', 6, true),
  ('account-maintenance-request', 'Account Maintenance Request', 'General account maintenance requests.', 7, true),
  ('document-request', 'Investor Documentation Request', 'Request outstanding documentation from an investor.', 8, true),
  ('axiskey-report-request', 'Request an AxisKey Report', 'Request a report on investors, orders, or account activity.', 9, true)
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
