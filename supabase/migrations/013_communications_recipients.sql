-- Recipients for a communication: either "all investors" or a specific
-- set of named clients. Client names are kept in their own table and
-- reused across communications (added once, picked from a saved list
-- every time after), per explicit instruction ("tiene que haber una
-- sección para poder añadir los nombres de los clientes y que se
-- queden guardados").
--
-- Purely additive -- no existing table, column, or row is touched.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table communications
  add column if not exists recipient_type text not null default 'all_investors'
    check (recipient_type in ('all_investors', 'specific'));

create table if not exists communication_recipients (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references communications(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (communication_id, client_id)
);

create index if not exists idx_communication_recipients_comm
  on communication_recipients(communication_id);

-- Service-role only, same as the rest of this feature's tables.
alter table clients enable row level security;
alter table communication_recipients enable row level security;
