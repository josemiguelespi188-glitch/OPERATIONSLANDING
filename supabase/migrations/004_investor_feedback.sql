-- Investor feedback captured from the "Rate Your Experience" landing page
-- linked in transactional emails (e.g. Allocation Confirmed). Purely
-- additive — a new table, no existing schema is touched.
--
-- investor_email is nullable: the landing page is anonymous today (no
-- session/token identifies who's rating), so there's no reliable way to
-- attribute a submission to a specific investor yet. Left in place for
-- when the email link carries an identifier.

create table if not exists investor_feedback (
  id uuid primary key default gen_random_uuid(),
  rating integer not null check (rating between 1 and 5),
  comment text,
  source text not null default 'allocation_confirmed_email',
  investor_email text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_investor_feedback_submitted_at
  on investor_feedback(submitted_at desc);
create index if not exists idx_investor_feedback_rating
  on investor_feedback(rating);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Same permissive-insert / service-role-only-read pattern as `requests`
-- in schema.sql: the landing page is public and unauthenticated, so
-- anyone with the anon key can insert a rating (in practice, only the
-- POST /api/investor-feedback route ever does, using the service role
-- key — this policy just documents/enables the intent). No select
-- policy is defined, so reads only work via the service role, used
-- server-side by GET /api/admin/investor-feedback.
-- ---------------------------------------------------------------------
alter table investor_feedback enable row level security;

drop policy if exists "anyone can submit feedback" on investor_feedback;
create policy "anyone can submit feedback"
  on investor_feedback for insert
  with check (true);
