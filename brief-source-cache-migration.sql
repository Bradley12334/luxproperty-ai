-- brief-source-cache-migration.sql  (brief-owned; additive, no existing table touched)
-- Durable L2 cache for per-source SECTION EVIDENCE (flood, crime, planning, amenities,
-- air quality, property-type, …). Complements brief_transaction_cache: that caches the
-- Land Registry SPARQL set; this caches the OTHER best-effort live sources, so a brief
-- refresh serves stable evidence instead of re-rolling flaky sources every request.
--
-- Only GENUINE responses are written (including legitimately-empty ones — no-parks,
-- zero-crime months). Fetch FAILURES are never written, so a district converges on
-- complete data instead of caching a bad roll. fetched_at is preserved so a served-
-- stale row can be aged/caveated by the section builder (real-time signals stay honest).

create table if not exists public.brief_source_cache (
  cache_key   text primary key,            -- "<location-sig>:<source>", e.g. "E8 1AA:flood"
  source      text not null,               -- source name, for ops/debug
  payload     jsonb not null,              -- the raw successful source result (pre-section, pre-gate)
  fetched_at  timestamptz not null,        -- when the live source actually responded
  expires_at  timestamptz not null         -- fetched_at + TTL
);

create index if not exists brief_source_cache_expires_idx
  on public.brief_source_cache (expires_at);

-- No RLS policy needed: written/read only by the service-key server client, exactly
-- like brief_transaction_cache. Never exposed to the anon/client key.
