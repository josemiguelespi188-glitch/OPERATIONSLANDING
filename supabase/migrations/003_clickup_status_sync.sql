-- Adds columns to receive live ClickUp task status via webhook.
-- Purely additive — no existing column, constraint, or row is touched.

alter table requests add column if not exists clickup_status_text text;
alter table requests add column if not exists clickup_status_type text;
