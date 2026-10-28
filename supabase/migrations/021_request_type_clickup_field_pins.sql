-- "Generate Document" field picker, second follow-up pass (Oct 2026):
-- the picker's main view now shows only an admin-chosen subset ("pinned")
-- of this request type's live ClickUp custom fields, with a "View More
-- ClickUp Fields" panel to pin/unpin from the full live catalog. Per
-- explicit product decision, pins are scoped per REQUEST TYPE (shared
-- across every document mapping that type has), not per individual
-- mapping -- so this lives on request_types, not on
-- request_document_templates.
alter table request_types add column if not exists pinned_clickup_fields jsonb not null default '[]'::jsonb;
