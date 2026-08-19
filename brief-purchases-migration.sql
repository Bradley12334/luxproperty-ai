-- brief-purchases-migration.sql  (pricing restructure; NEW table, no existing schema touched)
-- Applied: 2026-07-25 via Supabase MCP (migration name: create_brief_purchases)
-- ─────────────────────────────────────────────────────────────────────────────
-- ONE-OFF FULL BRIEF OWNERSHIP — the £149 permanent, per-postcode purchase.
--
-- WHY A NEW TABLE (not postcode_entitlements):
--   postcode_entitlements already models per-outcode paid access, but (a) it has NO
--   Stripe idempotency/audit column and (b) writing to it would also unlock the paid
--   Valuation product for that outcode (scope='postcode_brief' feeds
--   api/valuation-entitlement.js). Both are undesired here. brief_purchases is the
--   clean, decoupled home for Full Brief ownership and never touches users.plan.
--
-- GRANULARITY: outcode (district), matching how briefs, the transaction spine, and the
--   quota ledger (brief_generations.outcode) already key. Buying "SW1A 1AA" owns "SW1A".
--
-- IDEMPOTENCY: stripe_session_id is UNIQUE — Stripe retries checkout.session.completed,
--   so the webhook inserts ON CONFLICT (stripe_session_id) DO NOTHING. Double-PURCHASE
--   (a genuinely new session for an already-owned outcode) is prevented upstream at
--   checkout-creation, per the approved plan; this key covers pure webhook retries.
--
-- ACCESS MODEL: read/written ONLY by the serverless functions via the service-role key
--   (bypasses RLS). RLS ENABLED with NO policies, so anon/authenticated get no access —
--   identical to brief_generations / brief_transaction_cache.
--
-- SAFETY: append-only grant ledger; ON DELETE CASCADE cleans a removed account's rows.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.brief_purchases (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references public.users(id) on delete cascade,
  outcode            text        not null,               -- normalised district, e.g. "SW1A"
  stripe_session_id  text        not null unique,        -- idempotency: Stripe retries the webhook
  amount_paid        integer,                             -- pence, audit (14900)
  currency           text,                                -- audit ("gbp")
  granted_at         timestamptz not null default now()
);

-- The hot query: does this user own this outcode? (ownsFullBrief)
create index if not exists brief_purchases_user_outcode_idx
  on public.brief_purchases (user_id, outcode);

alter table public.brief_purchases enable row level security;
-- Intentionally NO policies: service-role only. RLS-on + no-policies denies all
-- anon/authenticated access, matching brief_generations and brief_transaction_cache.

comment on table public.brief_purchases is
  'One-off Full Brief per-postcode ownership (outcode granularity). stripe_session_id unique = webhook idempotency. Never grants users.plan. Owned by the pricing restructure.';
