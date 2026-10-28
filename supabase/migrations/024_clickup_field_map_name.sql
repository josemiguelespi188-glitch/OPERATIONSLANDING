-- Lets the Form Builder show each field's ClickUp connection status (and
-- what it's connected to) directly on its card in the field list, not
-- just inside the editor panel -- per explicit instruction that this
-- needs to be visible "desde afuera" without opening each field.
-- Storing the live field's name at connect time avoids an extra live
-- ClickUp call just to render the field grid.
alter table request_type_clickup_field_map add column if not exists clickup_field_name text not null default '';

-- Backfill the redemption-request pilot rows seeded by migration 023
-- with their real, already-confirmed ClickUp field names (from the same
-- CUSTOM_FIELD_MAP["redemption-request"] source those ids came from).
update request_type_clickup_field_map m
set clickup_field_name = v.name
from (
  values
    ('investorAccountName', 'Current Account Name'),
    ('offeringName', 'Offering Name'),
    ('orderNumber', 'Order Number'),
    ('redemptionAmount', 'Redemption Amount'),
    ('redemptionType', 'Redemption type'),
    ('notes', 'Note'),
    ('investorEmail', 'Investor Email'),
    ('requesterEmail', 'Client/Capital Raiser Email'),
    ('issuerApprovedRedemption', 'Issuer Approved Redemption')
) as v(field_key, name),
  request_types rt
where m.request_type_id = rt.id
  and rt.slug = 'redemption-request'
  and m.field_key = v.field_key
  and m.clickup_field_name = '';
