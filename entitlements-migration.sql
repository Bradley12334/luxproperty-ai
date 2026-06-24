-- ═══════════════════════════════════════════════════════════════════════════
-- LuxProperty.ai — Entitlements Migration
-- Applied: 2026-06-24
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- Purpose:
--   Adds a per-postcode entitlements table so that a Professional or Investor
--   purchase for a Postcode Brief automatically unlocks matching tier access
--   on the Property Valuation page for the same postcode.
--
-- Entitlement resolution order (implemented in api/valuation-entitlement.js):
--   1. Check postcode_entitlements for an active row matching (user_id, postcode, scope=postcode_brief)
--   2. Check postcode_entitlements for an active row matching (user_id, postcode, scope=valuation)
--   3. Fall back to users.plan (global plan — covers users on a blanket subscription)
--   4. Highest tier among (1), (2), (3) wins.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── postcode_entitlements ───────────────────────────────────────────────────
-- Tracks paid per-postcode access. One row per (user, postcode, scope).
-- scope = "postcode_brief"  → paid access to the Postcode Brief for this postcode
-- scope = "valuation"       → paid access to the Valuation product for this postcode
-- tier  = "professional" | "investor"
-- expires_at = NULL means perpetual (one-time purchase); date = subscription renewal date

create table if not exists public.postcode_entitlements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  -- Normalised postcode district, e.g. "BS1", "SW1A", "HA4"
  -- Stored as the outcode so a single purchase covers all addresses in the district.
  postcode     text not null,
  scope        text not null check (scope in ('postcode_brief', 'valuation')),
  tier         text not null check (tier in ('professional', 'investor')),
  -- NULL = perpetual / one-time purchase; set to subscription renewal date for subscriptions
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  -- Constraint: one active row per (user, postcode, scope). Upsert on conflict.
  unique (user_id, postcode, scope)
);

-- No RLS bypass needed for anon reads — but we gate reads via service_role in the API.
-- Anon SELECT needed: the frontend reads entitlements using the user's ID (UUID, unguessable).
alter table public.postcode_entitlements disable row level security;

-- Index: fast lookup by user + postcode
create index if not exists postcode_entitlements_user_postcode_idx
  on public.postcode_entitlements(user_id, postcode);

-- Index: fast expiry sweep
create index if not exists postcode_entitlements_expires_at_idx
  on public.postcode_entitlements(expires_at)
  where expires_at is not null;


-- ─── Helper view: active_postcode_entitlements ───────────────────────────────
-- Filters out expired rows. Use this view in application queries.
create or replace view public.active_postcode_entitlements as
  select *
  from public.postcode_entitlements
  where expires_at is null
     or expires_at > now();


-- ─── Verify ──────────────────────────────────────────────────────────────────
select
  t.tablename,
  t.rowsecurity as rls_enabled
from pg_tables t
where t.schemaname = 'public'
  and t.tablename in ('postcode_entitlements')
order by t.tablename;
