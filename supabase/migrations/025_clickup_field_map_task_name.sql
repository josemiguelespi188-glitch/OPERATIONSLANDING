-- Lets a locked form's investor-name-ish question be marked as "this is
-- what the ClickUp task itself gets named", not a custom field
-- connection. lib/integrations/clickup.ts's buildTaskName() already
-- derives the task's name from payload.investorName (wired per
-- FormSpec via submissionMapping.investorNameField, independent of
-- this table) -- that question was always correctly wired end to end,
-- it just had no way to show as "Connected" in the admin UI, since
-- Connect only ever searched for a real ClickUp custom field, and a
-- task's own name isn't one (reported live: "Who is the investor
-- requesting the redemption?" on redemption-request showed as "Not
-- connected" / red X even though it's the field that becomes the
-- task's name).
alter table request_type_clickup_field_map drop constraint if exists request_type_clickup_field_map_kind_check;
alter table request_type_clickup_field_map add constraint request_type_clickup_field_map_kind_check
  check (kind in ('text', 'number', 'checkbox', 'dropdown', 'task_name'));
