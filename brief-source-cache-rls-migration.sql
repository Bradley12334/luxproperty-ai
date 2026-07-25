-- brief-source-cache-rls-migration.sql  (security fix; follow-up to brief-source-cache-migration.sql)
-- Applied: 2026-07-25 via Supabase MCP (migration name: enable_rls_brief_source_cache)
--
-- WHY:
--   brief-source-cache-migration.sql created public.brief_source_cache and its comment
--   asserted it was service-role-only "exactly like brief_transaction_cache" — but it
--   OMITTED the `enable row level security` statement. So RLS was actually DISABLED:
--   anyone with the anon key could read AND WRITE cached brief evidence (flood, crime,
--   planning, amenities, air quality, …). That is a cache-POISONING vector into
--   user-facing brief data, flagged by the Supabase security advisor (rls_disabled,
--   level: critical).
--
-- FIX:
--   Enable RLS with NO policies, matching brief_transaction_cache and brief_generations
--   exactly. RLS-on + no-policies denies all anon/authenticated access; the serverless
--   brief functions use the service-role key, which bypasses RLS, so generation is
--   unaffected (verified post-change with live production briefs — SW1A/E8/M1 all ok,
--   including a cold generation that writes to this table under the service key).
--
-- SAFETY: idempotent — ENABLE on an already-enabled table is a no-op. No data touched.

alter table public.brief_source_cache enable row level security;

-- Verify (expect: rls_enabled = true, policy_count = 0 — same as brief_transaction_cache):
--   select c.relname, c.relrowsecurity as rls_enabled,
--          (select count(*) from pg_policies p
--             where p.schemaname='public' and p.tablename=c.relname) as policy_count
--   from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relname='brief_source_cache';
