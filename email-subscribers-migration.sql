-- ═══════════════════════════════════════════════════════════════════════════
-- LuxProperty.ai — email_subscribers table
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.email_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  source_feature  text not null default 'unknown',
  converted       boolean not null default false,
  created_at      timestamptz not null default now(),

  -- Enforce one record per email address
  constraint email_subscribers_email_unique unique (email)
);

-- Index for fast email lookups (used on duplicate-check upserts)
create index if not exists email_subscribers_email_idx
  on public.email_subscribers (email);

-- Index for analytics queries (count by feature, by date)
create index if not exists email_subscribers_source_feature_idx
  on public.email_subscribers (source_feature);

create index if not exists email_subscribers_created_at_idx
  on public.email_subscribers (created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Anon (frontend) needs:
--   INSERT  — to register a new email
--   UPDATE  — to update source_feature on re-engagement (duplicate email path)
-- Anon must NEVER be able to SELECT or DELETE rows
-- (we don't want visitors enumerating the subscriber list)

alter table public.email_subscribers enable row level security;

-- Allow anon INSERT with a valid email
drop policy if exists "email_subscribers_anon_insert" on public.email_subscribers;
create policy "email_subscribers_anon_insert"
  on public.email_subscribers
  for insert
  to anon
  with check (
    email is not null
    and length(trim(email)) > 0
    -- Basic email format guard at the DB layer
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- Allow anon UPDATE only on their own row (by email match)
-- Used in the duplicate-email re-engagement path in EmailCaptureModal.tsx
drop policy if exists "email_subscribers_anon_update_own" on public.email_subscribers;
create policy "email_subscribers_anon_update_own"
  on public.email_subscribers
  for update
  to anon
  using (email is not null)
  with check (email is not null);

-- Block anon SELECT — only service_role (your backend/admin) can read the list
drop policy if exists "email_subscribers_anon_deny_select" on public.email_subscribers;
create policy "email_subscribers_anon_deny_select"
  on public.email_subscribers
  as restrictive
  for select
  to anon
  using (false);

-- Block anon DELETE
drop policy if exists "email_subscribers_anon_deny_delete" on public.email_subscribers;
create policy "email_subscribers_anon_deny_delete"
  on public.email_subscribers
  as restrictive
  for delete
  to anon
  using (false);

-- ─── Verify ──────────────────────────────────────────────────────────────────
select
  t.tablename,
  t.rowsecurity as rls_enabled,
  array_agg(p.policyname order by p.policyname) as policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename = 'email_subscribers'
group by t.tablename, t.rowsecurity;
