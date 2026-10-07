-- Simplifies the Communications Calendar schema (migration 010) per
-- direct product feedback after seeing the first version:
--
-- - The email's actual HTML is now pasted in as code (a new html_code
--   column), not linked or uploaded -- drop html_url/html_file_path/
--   html_file_name (the communications-html storage bucket from
--   migration 010 is now unused; left in place rather than dropped
--   here, since removing a bucket means removing its objects first and
--   nothing was ever uploaded to it).
-- - channel, segment, compliance_report, and responsible were cut
--   entirely (not just hidden in the UI) to keep the form to what's
--   actually used: title, section type, send date, the HTML itself,
--   and (for the FAQ section type) faq_notes.
--
-- Purely additive/destructive to this one table -- no other table is
-- touched, and nothing here is reversible without a backup (any real
-- row data in the dropped columns is lost), but this table is brand
-- new and only ever held the 8 seeded placeholder rows, none of which
-- set these columns.

alter table communications add column if not exists html_code text;

alter table communications drop column if exists channel;
alter table communications drop column if exists segment;
alter table communications drop column if exists compliance_report;
alter table communications drop column if exists responsible;
alter table communications drop column if exists html_url;
alter table communications drop column if exists html_file_path;
alter table communications drop column if exists html_file_name;
