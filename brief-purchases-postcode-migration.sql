-- brief-purchases-postcode-migration.sql  (post-launch fix; ADDITIVE column, nothing dropped)
-- Applied: 2026-07-27 via Supabase MCP (migration name: add_postcode_to_brief_purchases)
-- ─────────────────────────────────────────────────────────────────────────────
-- ROUTE BUYERS TO THEIR TYPED FULL POSTCODE.
--
-- A buyer who types "SW1A 1AA" was landing on /brief/SW1A — the district-CENTROID brief,
-- which legitimately suppresses point sections (schools, stations, flood-at-location). This
-- column records the buyer's ORIGINALLY-TYPED full postcode so the success page and the
-- "My briefs" library can link straight to the fully-populated POINT brief.
--
-- ENTITLEMENT UNCHANGED: `outcode` remains the ownership key (ownsFullBrief keys on it, the
-- quota exemption derives it via outcodeOf). `postcode` is display/routing ONLY and is never
-- consulted for entitlement. Owning "SW1A" still serves INV depth for ANY postcode in it.
--
-- NULLABLE: a bare-outcode purchase (buyer typed only "E8") writes NULL — the district brief
-- IS their destination. Pre-migration rows are NULL too (the table was empty at apply time,
-- so this is theoretical); both fall back to /brief/<outcode> gracefully.
--
-- BACKWARD-COMPATIBLE: additive column, old code ignores it → safe to apply before merge and
-- safe to leave in place on rollback (revert the code, keep the column).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.brief_purchases
  add column if not exists postcode text;

comment on column public.brief_purchases.postcode is
  'Originally-purchased FULL postcode (e.g. "SW1A 1AA") for routing the buyer to their point brief. NULL for bare-outcode purchases and pre-migration rows. Display/routing ONLY — the entitlement key remains outcode, never checked against this.';
