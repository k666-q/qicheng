-- Phase 2: 计划生成与管理
-- Tables: plans, plan_versions, tasks

-- 正式计划
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references onboarding_sessions(id),
  title text not null,
  domain text not null,
  total_weeks int not null default 4,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'abandoned')),
  draft_snapshot jsonb not null default '{}',
  user_quotes jsonb not null default '[]',
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plans enable row level security;
create policy "users manage own plans" on plans
  for all using (auth.uid() = user_id or user_id is null);

-- 计划版本快照
create table if not exists plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  change_description text,
  created_at timestamptz not null default now()
);

alter table plan_versions enable row level security;
create policy "versions follow plan access" on plan_versions
  for all using (
    plan_id in (select id from plans where auth.uid() = user_id or user_id is null)
  );

-- 任务
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  stage_index int not null,
  stage_name text not null,
  task_index int not null,
  title_plain text not null,
  title_professional text not null,
  description text,
  estimated_minutes int not null default 30,
  difficulty int not null default 1 check (difficulty between 1 and 5),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  outcome text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table tasks enable row level security;
create policy "tasks follow plan access" on tasks
  for all using (
    plan_id in (select id from plans where auth.uid() = user_id or user_id is null)
  );

create index idx_tasks_plan_stage on tasks(plan_id, stage_index, task_index);
