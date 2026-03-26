-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── capacity_profiles ────────────────────────────────────────────────────────
create table public.capacity_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  weekday_minutes  int  not null default 480,
  weekend_minutes  int  not null default 120,
  preferred_start_minute int not null default 540,
  scheduling_mode  text not null default 'suggest' check (scheduling_mode in ('suggest', 'auto')),
  system_mode      text not null default 'warm_start' check (system_mode in ('warm_start', 'calibration', 'personalized', 'autopilot')),
  completed_task_count int not null default 0,
  session_count    int  not null default 0,
  days_active      int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── tasks ────────────────────────────────────────────────────────────────────
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  type             text not null default 'standard' check (type in ('habit', 'admin', 'standard', 'deep_work', 'unknown')),
  estimated_minutes int not null check (estimated_minutes > 0),
  deadline_date    date not null,
  status           text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  is_fixed         boolean not null default false,
  is_soft_deadline boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index tasks_user_deadline on public.tasks (user_id, deadline_date);
create index tasks_user_status   on public.tasks (user_id, status);

-- ─── schedule_blocks ──────────────────────────────────────────────────────────
create table public.schedule_blocks (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  start_minute      int  not null check (start_minute >= 0 and start_minute < 1440),
  duration_minutes  int  not null check (duration_minutes > 0),
  is_fixed          boolean not null default false,
  rebalance_plan_id uuid,
  created_at        timestamptz not null default now()
);

create index blocks_user_date on public.schedule_blocks (user_id, date);
create index blocks_task_id   on public.schedule_blocks (task_id);

-- ─── day_capacities ───────────────────────────────────────────────────────────
-- Maintained by the app on task add/complete/rebalance.
-- effective_minutes is always declared_minutes * 0.75 — never surface raw to client.
create table public.day_capacities (
  user_id            uuid not null references auth.users(id) on delete cascade,
  date               date not null,
  declared_minutes   int  not null,
  effective_minutes  int  not null,  -- = declared * 0.75, computed server-side
  scheduled_minutes  int  not null default 0,
  time_bank_minutes  int  not null default 0,
  primary key (user_id, date)
);

-- ─── time_bank ────────────────────────────────────────────────────────────────
create table public.time_bank (
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  balance_minutes int  not null default 0 check (balance_minutes >= 0),
  primary key (user_id, date)
);

-- ─── time_sessions ────────────────────────────────────────────────────────────
create table public.time_sessions (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  estimated_minutes int  not null,
  actual_minutes    int  not null check (actual_minutes >= 0),
  is_valid          boolean not null default false,  -- true if actual >= 5 min
  completed_at      timestamptz not null default now()
);

create index sessions_user_date on public.time_sessions (user_id, date);
create index sessions_task_id   on public.time_sessions (task_id);

-- ─── rebalance_plans ─────────────────────────────────────────────────────────
create table public.rebalance_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  slip_level   int  not null check (slip_level in (1, 2, 3)),
  moves        jsonb not null default '[]',
  accepted     boolean not null default false
);

create index rebalance_user_triggered on public.rebalance_plans (user_id, triggered_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.capacity_profiles  enable row level security;
alter table public.tasks               enable row level security;
alter table public.schedule_blocks     enable row level security;
alter table public.day_capacities      enable row level security;
alter table public.time_bank           enable row level security;
alter table public.time_sessions       enable row level security;
alter table public.rebalance_plans     enable row level security;

-- Each user can only see and modify their own rows
create policy "own data" on public.capacity_profiles  for all using (auth.uid() = user_id);
create policy "own data" on public.tasks               for all using (auth.uid() = user_id);
create policy "own data" on public.schedule_blocks     for all using (auth.uid() = user_id);
create policy "own data" on public.day_capacities      for all using (auth.uid() = user_id);
create policy "own data" on public.time_bank           for all using (auth.uid() = user_id);
create policy "own data" on public.time_sessions       for all using (auth.uid() = user_id);
create policy "own data" on public.rebalance_plans     for all using (auth.uid() = user_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger capacity_profiles_updated_at
  before update on public.capacity_profiles
  for each row execute function public.set_updated_at();

-- ─── RPC: increment session count on capacity_profiles ───────────────────────
create or replace function public.increment_session_count(uid uuid)
returns void language plpgsql security definer as $$
begin
  update public.capacity_profiles
  set session_count = session_count + 1
  where user_id = uid;
end;
$$;

-- ─── RPC: increment completed task count ─────────────────────────────────────
create or replace function public.increment_completed_task_count(uid uuid)
returns void language plpgsql security definer as $$
begin
  update public.capacity_profiles
  set completed_task_count = completed_task_count + 1
  where user_id = uid;
end;
$$;

-- ─── RPC: add scheduled minutes to a day_capacity row ─────────────────────────
create or replace function public.add_scheduled_minutes(uid uuid, target_date date, minutes_to_add int)
returns void language plpgsql security definer as $$
begin
  update public.day_capacities
  set scheduled_minutes = scheduled_minutes + minutes_to_add
  where user_id = uid and date = target_date;
end;
$$;

-- ─── RPC: increment days_active on capacity_profiles ──────────────────────────
create or replace function public.increment_days_active(uid uuid)
returns void language plpgsql security definer as $$
begin
  update public.capacity_profiles
  set days_active = days_active + 1
  where user_id = uid;
end;
$$;

-- ─── Trigger: auto-create capacity_profile on user signup ────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.capacity_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
