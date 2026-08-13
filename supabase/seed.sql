-- Seed the request_types catalog. Safe to re-run.
-- is_locked = true on the 3 hardcoded forms means the future Form Builder
-- UI must refuse to edit/delete them — they stay code-driven pages, not
-- database-driven ones (uses_dynamic_form stays false for every row here).
insert into request_types (slug, name, description, sort_order, is_locked) values
  ('ira-funding-request', 'IRA Funding Request', 'Request funds from an IRA custodian.', 1, true),
  ('title-transfer-request', 'Title Transfer Request', 'Submit a title transfer request.', 2, true),
  ('redemption-request', 'Redemption Request', 'Submit an investor redemption request.', 3, true),
  ('investor-information-update', 'Investor Information Update', 'Request updates to investor records.', 4, false),
  ('account-maintenance-request', 'Account Maintenance Request', 'General account maintenance requests.', 5, false),
  ('document-request', 'Document Request', 'Request investor or deal documentation.', 6, false),
  ('custom-request', 'Custom Request', 'Submit a request not covered by standard processes.', 7, false)
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
