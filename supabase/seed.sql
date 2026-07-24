-- Seed the request_types catalog. Safe to re-run.
insert into request_types (slug, name, description, sort_order) values
  ('ira-funding-request', 'IRA Funding Request', 'Request funds from an IRA custodian.', 1),
  ('title-transfer-request', 'Title Transfer Request', 'Submit a title transfer request.', 2),
  ('redemption-request', 'Redemption Request', 'Submit an investor redemption request.', 3),
  ('investor-information-update', 'Investor Information Update', 'Request updates to investor records.', 4),
  ('account-maintenance-request', 'Account Maintenance Request', 'General account maintenance requests.', 5),
  ('document-request', 'Document Request', 'Request investor or deal documentation.', 6),
  ('custom-request', 'Custom Request', 'Submit a request not covered by standard processes.', 7)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Create a public storage bucket for request attachments.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;
