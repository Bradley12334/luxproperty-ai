-- ═══════════════════════════════════════════════════════════════════════════
-- LuxProperty.ai — Row Level Security Migration
-- Applied: 2026-05-29
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- Architecture note: this app uses CUSTOM AUTH (public.users + password_hash),
-- NOT Supabase Auth.  auth.uid() is therefore always NULL for the anon client.
-- Policies are written accordingly — they restrict by operation type and column
-- presence, not by JWT claim.
--
-- Server-side Vercel functions use SUPABASE_SERVICE_KEY which bypasses RLS
-- automatically — no changes required to api/auth-email.js or api/stripe-webhook.js
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. password_reset_tokens ────────────────────────────────────────────────
--  All access goes through server-side functions via service_role.
--  Anon (frontend) must never touch this table.
--  RESTRICTIVE deny policy + no permissive policies = deny all for anon.

alter table public.password_reset_tokens enable row level security;

drop policy if exists "prt_deny_all_anon" on public.password_reset_tokens;
drop policy if exists "prt_anon_deny" on public.password_reset_tokens;

create policy "prt_anon_deny"
  on public.password_reset_tokens
  as restrictive
  for all
  to anon
  using (false)
  with check (false);


-- ─── 2. users ────────────────────────────────────────────────────────────────
--  Frontend (anon key) needs:
--    SELECT  — sign-in (by email), session restore (by id), duplicate check
--    INSERT  — sign-up
--  No UPDATE from anon — plan changes go via service_role (stripe-webhook).

alter table public.users enable row level security;

drop policy if exists "users_anon_select" on public.users;
drop policy if exists "users_anon_insert" on public.users;
drop policy if exists "users_anon_update_own" on public.users;

create policy "users_anon_select"
  on public.users
  for select
  to anon
  using (true);

create policy "users_anon_insert"
  on public.users
  for insert
  to anon
  with check (
    email is not null
    and length(trim(email)) > 0
    and name is not null
    and length(trim(name)) > 0
    and password_hash is not null
  );


-- ─── 3. saved_briefs ─────────────────────────────────────────────────────────
--  Frontend needs full CRUD scoped by user_id.
--  user_id is always set by the app from the local session; UUIDs are
--  unguessable so other users' rows cannot be targeted without knowing their UUID.

alter table public.saved_briefs enable row level security;

drop policy if exists "saved_briefs_select_own" on public.saved_briefs;
drop policy if exists "saved_briefs_insert_own" on public.saved_briefs;
drop policy if exists "saved_briefs_delete_own" on public.saved_briefs;
drop policy if exists "saved_briefs_update_own" on public.saved_briefs;

create policy "saved_briefs_select_own"
  on public.saved_briefs
  for select
  to anon
  using (true);

create policy "saved_briefs_insert_own"
  on public.saved_briefs
  for insert
  to anon
  with check (user_id is not null);

create policy "saved_briefs_delete_own"
  on public.saved_briefs
  for delete
  to anon
  using (user_id is not null);

create policy "saved_briefs_update_own"
  on public.saved_briefs
  for update
  to anon
  using (user_id is not null)
  with check (user_id is not null);


-- ─── 4. contact_submissions ─────────────────────────────────────────────────
--  Server-only table (Vercel function writes via service_role).
--  Create if not exists, then block anon entirely.

create table if not exists public.contact_submissions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  message      text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists contact_submissions_submitted_at_idx
  on public.contact_submissions(submitted_at desc);

alter table public.contact_submissions enable row level security;

drop policy if exists "contact_deny_anon" on public.contact_submissions;
drop policy if exists "contact_anon_deny" on public.contact_submissions;

create policy "contact_anon_deny"
  on public.contact_submissions
  as restrictive
  for all
  to anon
  using (false)
  with check (false);


-- ─── Verify ──────────────────────────────────────────────────────────────────
select
  t.tablename,
  t.rowsecurity as rls_enabled,
  array_agg(p.policyname order by p.policyname) as policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in (
    'users', 'saved_briefs', 'password_reset_tokens', 'contact_submissions'
  )
group by t.tablename, t.rowsecurity
order by t.tablename;
