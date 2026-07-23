-- brief-generations-migration.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BRIEF PIPELINE — per-account monthly generation ledger, the server-side backing
-- for the Explorer "3 briefs / calendar month" quota. Owned by the brief rebuild
-- (NEW table, no edits to any shared schema file — analogous to
-- brief_transaction_cache).
--
-- WHY:
--   The pricing page grants Explorer (free) 3 briefs per calendar month; PRO/INV
--   are unlimited. Quota MUST be enforced server-side at generation time — a
--   client counter (the legacy localStorage lux_usage_YYYY-MM) is trivially reset.
--   This table is the durable, per-account count: one row per brief GENERATION.
--
-- WHAT COUNTS:
--   A row is inserted per successful generation, so quota counts GENERATIONS, not
--   data fetches. A warm/cached transaction district (L1 in-process or L2
--   brief_transaction_cache) still inserts a row and still consumes quota — the
--   shared transaction cache never leaks across the quota boundary.
--
--   Quota applies ONLY to signed-in accounts. Anonymous (logged-out) visitors get
--   unlimited Explorer-tier SECTIONS with no row written here — the funnel nudges
--   sign-in to save briefs and track the 3 free monthly briefs. There is no
--   reliable per-user key for an anonymous visitor, so no quota is asserted for
--   them (documented product decision, not an oversight).
--
-- ACCESS MODEL:
--   Read and written ONLY by the serverless brief functions using the service-role
--   key (which bypasses RLS). RLS is ENABLED with NO policies, so anon/authenticated
--   clients get no access by default — consistent with every other brief table.
--
-- SAFETY: append-only ledger. No foreign-key cascade concerns beyond user deletion
--   (ON DELETE CASCADE cleans a removed account's rows). Nothing else depends on it.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.brief_generations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  month       text        not null,               -- 'YYYY-MM', UTC calendar month at generation time
  outcode     text        not null,               -- audit only, e.g. "E8"; quota counts rows, not distinct outcodes
  created_at  timestamptz not null default now()
);

-- The single hot query: count(*) for a user within the current calendar month.
create index if not exists brief_generations_user_month_idx
  on public.brief_generations (user_id, month);

alter table public.brief_generations enable row level security;
-- Intentionally NO policies: service-role only (bypasses RLS); RLS-on + no-policies
-- denies all anon/authenticated access, matching brief_transaction_cache and the
-- other brief tables.

comment on table public.brief_generations is
  'Brief pipeline: per-account monthly generation ledger backing the Explorer 3-briefs/month quota. Counts generations (not cache hits); signed-in accounts only. Owned by the brief rebuild.';
