-- Renames the Communications Calendar's status model (migration 010)
-- to the SLA stages actually wanted: "idea" and "in_design" collapse
-- into one "building" stage (in creation/processing), and "approved"
-- and "scheduled" collapse into one "ready_for_launch" stage -- the
-- user only ever named one status for each of those two pairs
-- ("processing o building", "Ready for Launch"), so existing rows are
-- migrated, not just the label set.
--
-- New status set: building -> pending_approval -> (ready_for_launch |
-- changes_requested) -> deployed. changes_requested loops back to
-- building, same as before.

alter table communications drop constraint if exists communications_status_check;

update communications set status = 'building' where status in ('idea', 'in_design');
update communications set status = 'pending_approval' where status = 'sent_for_approval';
update communications set status = 'ready_for_launch' where status in ('approved', 'scheduled');
update communications set status = 'deployed' where status = 'sent';
-- 'changes_requested' keeps its own name -- nothing to migrate for it.

alter table communications alter column status set default 'building';
alter table communications add constraint communications_status_check
  check (status in ('building', 'pending_approval', 'changes_requested', 'ready_for_launch', 'deployed'));
