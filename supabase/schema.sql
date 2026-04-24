-- IronLog MVP: таблицы для Supabase (включи RLS под свой проект; для теста можно отключить RLS)

create table if not exists public.workout_templates (
  id text primary key,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id text primary key,
  saved_at timestamptz not null,
  name text not null,
  duration_seconds integer not null,
  tonnage integer not null,
  sets_completed integer not null,
  exercise_count integer not null
);

create index if not exists workout_logs_saved_at_idx on public.workout_logs (saved_at desc);

create table if not exists public.personal_records (
  exercise_id text primary key,
  exercise_name text not null,
  weight double precision not null,
  reps integer not null default 0,
  achieved_at timestamptz not null
);

create table if not exists public.custom_exercises (
  id text primary key,
  exercise jsonb not null
);
