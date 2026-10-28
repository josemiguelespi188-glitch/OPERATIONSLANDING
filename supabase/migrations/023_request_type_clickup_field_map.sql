-- Admin-editable ClickUp field connections, per request type field (Oct
-- 2026). Until now, which ClickUp custom field a form question's answer
-- gets written to lived only in CUSTOM_FIELD_MAP/ATTACHMENT_FIELD_MAP
-- (lib/integrations/clickup.ts), hardcoded in source -- changing it
-- needed a deploy. This table lets an admin connect/reconnect a locked
-- form's question to a real ClickUp field id directly from
-- /admin/forms/[id]'s field editor, with a live "Connect" check against
-- that request type's ClickUp list (see
-- app/api/admin/request-types/[id]/clickup-field-map/connect/route.ts).
--
-- A row here, when present, OVERRIDES CUSTOM_FIELD_MAP for that one
-- field key at sync time (lib/services/clickupFieldMapOverrides.ts) --
-- a field key with no row here still falls back to CUSTOM_FIELD_MAP
-- unchanged, so nothing already working regresses by this table simply
-- existing and being empty.
create table if not exists request_type_clickup_field_map (
  id uuid primary key default gen_random_uuid(),
  request_type_id uuid not null references request_types(id) on delete cascade,
  field_key text not null,
  clickup_field_id text not null,
  -- Matches ClickUpFieldTarget's "kind" union in lib/integrations/clickup.ts
  -- (what the sync write path needs to know how to format the value) --
  -- not ClickUp's own raw field type string.
  kind text not null check (kind in ('text', 'number', 'checkbox', 'dropdown')),
  -- Form option label -> ClickUp dropdown option id. Only meaningful
  -- when kind = 'dropdown'; '{}' otherwise.
  option_map jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  unique (request_type_id, field_key)
);

alter table request_type_clickup_field_map enable row level security;
-- No policies: service-role only, same strictness as pdf_templates,
-- order_tracking_links, and every other admin-only table in this app.

create index if not exists idx_request_type_clickup_field_map_request_type
  on request_type_clickup_field_map(request_type_id);

-- One-time pilot seed: redemption-request's fields, using the exact ids
-- already confirmed in CUSTOM_FIELD_MAP["redemption-request"]
-- (lib/integrations/clickup.ts) -- so the admin sees this form's
-- questions as already connected instead of starting from a blank
-- slate, and can use it as a reference for what a correct connection
-- looks like before trying others. redemptionAmount sends to TWO
-- ClickUp fields in CUSTOM_FIELD_MAP (both amount fields on this list
-- always carry the same value on real submitted tasks) -- this new
-- table only supports one target per field key, so only the primary id
-- (d90c8115...) is seeded here; the second (e98c4094...) is a known,
-- accepted gap in this first pass, not a bug.
insert into request_type_clickup_field_map (request_type_id, field_key, clickup_field_id, kind, option_map)
select rt.id, v.field_key, v.clickup_field_id, v.kind, v.option_map::jsonb
from request_types rt
cross join (
  values
    ('investorAccountName', '3026a4c9-b01c-41cb-ab92-87b2cf417ba1', 'text', '{}'),
    ('offeringName', '3a84a910-2a20-4c12-984f-d3e89926550a', 'text', '{}'),
    ('orderNumber', '70257f39-e3a9-4c45-88bf-e5c5677ccc03', 'text', '{}'),
    ('redemptionAmount', 'd90c8115-3271-4597-89ac-bfac73e77c28', 'number', '{}'),
    ('redemptionType', 'be5ab0e3-b125-4f58-ae22-8831e67dc294', 'dropdown',
      '{"Full":"6507524b-2070-4586-b0a9-44177f7822b8","Partial":"e93f8731-85ef-4523-a32d-cb3ee259d522"}'),
    ('notes', '42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f', 'text', '{}'),
    ('investorEmail', '6429a23e-370b-40f8-ac77-f8273b2b7787', 'text', '{}'),
    ('requesterEmail', 'a655d17c-0108-470a-8d83-acf2a2abfeea', 'text', '{}'),
    ('issuerApprovedRedemption', '4fdc8130-8d98-4172-8003-7f3e39ff5c5a', 'checkbox', '{}')
) as v(field_key, clickup_field_id, kind, option_map)
where rt.slug = 'redemption-request'
on conflict (request_type_id, field_key) do nothing;
