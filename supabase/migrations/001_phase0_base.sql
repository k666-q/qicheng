-- Phase 0: 基础表
-- users 表由 Supabase Auth 自动管理（auth.users），这里建业务层扩展表

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- projects: 用户创建的学习项目
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  domain text, -- programming_app / visual_design / data_analysis / product_business
  status text not null default 'draft', -- draft / active / paused / completed
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Users can manage own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- prompt_runs: AI 调用记录
create table public.prompt_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  prompt_type text not null, -- onboarding / draft / plan / task_deep_dive / profile
  prompt_version text not null,
  input jsonb not null,
  raw_output text,
  parsed_output jsonb,
  parse_success boolean default false,
  model text,
  tokens_used integer,
  duration_ms integer,
  created_at timestamptz default now()
);

alter table public.prompt_runs enable row level security;

create policy "Users can read own prompt_runs"
  on public.prompt_runs for select
  using (auth.uid() = user_id);

create policy "Service can insert prompt_runs"
  on public.prompt_runs for insert
  with check (true);
