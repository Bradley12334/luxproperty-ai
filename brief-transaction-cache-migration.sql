-- brief-transaction-cache-migration.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BRIEF PIPELINE — durable cross-instance cache of the Land Registry transaction
-- set. Owned by the brief rebuild (NEW table, no edits to any shared schema file).
--
-- WHY (measured, Phase 2b reliability pass):
--   The transaction spine's only slow step is the Land Registry SPARQL scan
--   (resolve ≈ 0.1s, stats ≈ 0.0s, SPARQL 16–49s). Latency is endpoint-scan
--   VARIANCE, not our row volume (a 2.1k-row district measured 48.7s while a
--   4.5k-row district measured 16.7s). The in-process cache makes warm repeats
--   instant, but it lives only for the lifetime of a warm serverless instance, so
--   every COLD instance refetches and re-runs the variance tail — which is what
--   was clipping the 50s budget and returning UNAVAILABLE for routine latency.
--
--   This table is the durable layer beneath the in-process cache: the first
--   generation of a district ANYWHERE populates it; every later request (any
--   instance, any user) reads it in ~tens of ms. UNAVAILABLE then reverts to what
--   the spec intends — a genuine source outage, not a slow scan.
--
-- ACCESS MODEL:
--   Read and written ONLY by the serverless brief functions using the service-role
--   key (which bypasses RLS). RLS is enabled with NO policies, so anon/authenticated
--   clients get no access by default — consistent with every other table here.
--
-- SAFETY: best-effort cache. Safe to TRUNCATE at any time; the pipeline degrades to
--   a live fetch on a miss. No foreign keys, nothing depends on it.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.brief_transaction_cache (
  district    text        not null,               -- postcode outcode, e.g. "E8"
  years       smallint    not null,               -- trailing full-year window size
  payload     jsonb       not null,               -- the whole TransactionSet (district, window, transactions[], meta)
  row_count   integer     not null default 0,     -- denormalised meta.count for cheap inspection
  truncated   boolean     not null default false, -- denormalised meta.truncated
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null,               -- now() + TTL at write time (PPD updates at most daily)
  primary key (district, years)
);

-- Sweep support / manual pruning of stale rows.
create index if not exists brief_transaction_cache_expires_idx
  on public.brief_transaction_cache (expires_at);

alter table public.brief_transaction_cache enable row level security;
-- Intentionally NO policies: service-role only (bypasses RLS); RLS-on + no-policies
-- denies all anon/authenticated access, matching the other brief tables.

comment on table public.brief_transaction_cache is
  'Brief pipeline: durable cross-instance cache of the HM Land Registry transaction set per (district, years). Owned by the brief rebuild. Best-effort; safe to truncate.';
