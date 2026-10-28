-- "Generate Document" can hold more than one document mapping per
-- request type (e.g. several different Redemption Request document
-- variants) -- per explicit feedback right after the first pilot
-- mapping was built and tested live. Drops the one-per-type uniqueness
-- and adds a name so the admin can tell mappings apart when picking one
-- to generate from.
alter table request_document_templates add column if not exists name text not null default 'Default';

-- The unique constraint was created inline on request_type_id
-- (`... unique references ...`), so Postgres named it with its standard
-- "<table>_<column>_key" convention.
alter table request_document_templates drop constraint if exists request_document_templates_request_type_id_key;

create index if not exists idx_request_document_templates_request_type
  on request_document_templates(request_type_id);
