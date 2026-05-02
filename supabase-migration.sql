-- LuxProperty.ai — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query → Paste → Run

-- ─── Users table ─────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text not null,   -- plain text for now (upgrade to bcrypt when adding backend)
  plan text not null default 'explorer' check (plan in ('explorer','professional','investor')),
  created_at timestamptz not null default now()
);

-- Disable RLS (we handle auth ourselves in the app)
alter table public.users disable row level security;

-- ─── Saved briefs table ───────────────────────────────────────────────────────
create table if not exists public.saved_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  postcode text not null,
  area_name text not null,
  report_json text not null,   -- full BriefReport serialised as JSON
  saved_at timestamptz not null default now()
);

alter table public.saved_briefs disable row level security;

-- Index for fast user lookups
create index if not exists saved_briefs_user_id_idx on public.saved_briefs(user_id);

-- ─── Password reset tokens ──────────────────────────────────────────────────
create table if not exists public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.password_reset_tokens disable row level security;

-- ─── Seed Bradley's admin account ────────────────────────────────────────────
insert into public.users (email, name, password_hash, plan)
values ('bradleyskana@hotmail.com', 'Bradley Skana', 'lux2026!', 'investor')
on conflict (email) do update set plan = 'investor';
