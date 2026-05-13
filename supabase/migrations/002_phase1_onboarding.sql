-- Phase 1: 引导对话 + 实时草图
-- Tables: onboarding_sessions, onboarding_answers, draft_plans

-- 引导对话会话
create table if not exists onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  initial_input text not null,
  current_step int not null default 1,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table onboarding_sessions enable row level security;
create policy "users manage own sessions" on onboarding_sessions
  for all using (auth.uid() = user_id or user_id is null);

-- 引导问题回答（每问一条记录）
create table if not exists onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  step int not null,
  question_text text not null,
  answer_type text not null check (answer_type in ('option', 'free_text', 'skipped')),
  answer_value text,
  parsed_fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table onboarding_answers enable row level security;
create policy "answers follow session access" on onboarding_answers
  for all using (
    session_id in (select id from onboarding_sessions where auth.uid() = user_id or user_id is null)
  );

-- 实时草图
create table if not exists draft_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  goal_raw text,
  domain text,
  goal_type text,
  clarity_level text,
  desired_outcome text,
  starting_point text,
  prior_experience text,
  core_fear text,
  motivation_type text,
  time_budget jsonb,
  failure_pattern text,
  tone_hint text,
  stage_framework jsonb,
  risk_note text,
  draft_overrides jsonb not null default '{}',
  summary_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table draft_plans enable row level security;
create policy "drafts follow session access" on draft_plans
  for all using (
    session_id in (select id from onboarding_sessions where auth.uid() = user_id or user_id is null)
  );
