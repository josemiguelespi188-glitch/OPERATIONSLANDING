-- SA Review: "perfect format" reference templates and an ongoing skill
-- knowledge base, both admin-managed from /admin/sa-review. Purely
-- additive -- two new tables + a storage bucket, no existing schema
-- touched. See CLAUDE.md's "SA Review" section for how these feed into
-- lib/services/saReview/analyzeWithClaude.ts.

-- At most a handful of rows ever (an admin swaps the active template
-- occasionally), but more than one can exist so an admin can keep old
-- versions around while only one is "active" (used as the live
-- reference on every future review).
create table if not exists sa_format_templates (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  is_active boolean not null default false,
  uploaded_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sa_format_templates_active on sa_format_templates(is_active);

-- Free-text guidance an admin keeps feeding the reviewer over time (new
-- rules, corrections, edge cases the checklist doesn't cover yet) --
-- every active entry is appended to the Claude system prompt on every
-- future review (lib/services/saReview/knowledgeBase.ts), so an admin
-- can improve review quality without a code change.
create table if not exists sa_skill_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sa_skill_knowledge_active on sa_skill_knowledge(is_active);

create or replace function set_sa_skill_knowledge_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sa_skill_knowledge_updated_at on sa_skill_knowledge;
create trigger trg_sa_skill_knowledge_updated_at
  before update on sa_skill_knowledge
  for each row execute function set_sa_skill_knowledge_updated_at();

-- Same strictness as sa_reviews: RLS enabled, no policies, service-role
-- client only, used exclusively by requireAdmin-gated /api/admin/sa-review/*
-- routes.
alter table sa_format_templates enable row level security;
alter table sa_skill_knowledge enable row level security;

-- Private bucket for uploaded "perfect format" example .docx files.
insert into storage.buckets (id, name, public)
values ('sa-format-templates', 'sa-format-templates', false)
on conflict (id) do nothing;
