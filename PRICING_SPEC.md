# LuxProperty AI — Pricing Restructure Specification
Build contract. Paste at the top of every pricing session. Scope: Stripe products, checkout, webhook entitlements, pricing page, entitlement config, quota constant, save-to-account. READ-ONLY: the brief pipeline internals, auth internals (the new token mechanism is USED, never modified), everything else. Shared-file diffs to Bradley before applying.

## The new structure (ships as ONE coherent event)
- EXPLORER — free. 2 briefs/month (changed from 3). Area screening. The funnel.
- FULL BRIEF — £149 one-off. The complete Investor-depth brief for ONE postcode, permanently owned, auto-saved to the buyer's account. THE HERO for buyer traffic.
- INVESTOR — £39.99/mo unchanged. Unlimited everything + portfolio + cross-area tools. The professional product.
- PROFESSIONAL (£4.99/mo) — RETIRED: removed from the page, no new signups. Existing PRO subscribers GRANDFATHERED (keep PRO until they cancel; Stripe subscriptions untouched; PRO tier stays in the entitlement config for them and for depth-variant machinery — it just stops being sold).

## Stripe (the careful part)
- Full Brief = new Product + Price, Checkout in PAYMENT mode (not subscription). IDs verified against the LIVE Stripe account before any code references them (the prod_UKur… lesson).
- Webhook: checkout.session.completed (payment mode) grants the entitlement via client_reference_id → account. Grants are per-postcode ownership — users.plan is NEVER touched by one-off purchases. Idempotent (Stripe retries). Must not interfere with existing subscription webhook paths.
- The postcode being purchased travels in the checkout session metadata; the webhook reads it from there.
- Entitlement storage: new table (e.g. brief_purchases: user_id, postcode/outcode, granted_at, stripe_session_id unique for idempotency). Service-role-only RLS, migration shown-and-approved before applying — the established pattern.

## Entitlement semantics (layers ON the existing config)
- accountTier() unchanged for subscriptions. New layer: ownsFullBrief(userId, postcode) → if true, serve INVESTOR-depth payload for THAT postcode regardless of plan. All other postcodes gate by plan as today.
- Identity comes from the verified session token ONLY (the new mechanism). Purchases require a signed-in account (checkout embeds the verified userId as client_reference_id — an anonymous visitor hitting "buy" goes through sign-in/sign-up first).
- Quota: owned-postcode generations NEVER consume free quota. Regenerating an owned postcode is free forever.
- Gating invariants: server-side filtering; the payload-grep test extended — a Full Brief owner gets full data for owned postcodes ONLY; a request for a non-owned postcode from the same account still gates by plan.

## Save-to-account (ships with launch)
- A Full Brief purchase AUTO-SAVES its postcode to the buyer's account library — no extra click; they paid, it's theirs.
- Library ≠ Investor portfolio: one-off buyers see "My briefs" (their owned postcodes, revisit free); the full portfolio toolset (compare, track, unlimited) stays Investor-only. State the UI distinction.
- Free users see the save/export affordance LOCKED (upsell surface), not hidden.

## Quota change
- EXPLORER_MONTHLY_QUOTA: 3 → 2 (the named constant). Ships in the same deploy as the one-off — never before it.
- The quota wall and locked-preview CTAs updated to offer BOTH paths contextually: "Get the full brief on this postcode — £149, yours permanently" alongside the Investor subscription. Wall copy stays sell-not-scold.

## Pricing page redesign
- Three offers, hierarchy: Full Brief heroed for buyer traffic; Explorer as the taste; Investor as the professional tier.
- Real product showcased: actual verdict card, real locked previews, honest Explorer-vs-Full comparison. No mockups, no invented claims.
- PDF export promised ONLY per its staging status (below). Rental-demand line already reworded (letting economics) — preserve it.
- Existing PRO subscribers: nothing on the page for them, but their account/billing views must not break — verify.

## PDF export — STAGED (fast-follow, own session)
- NOT in the launch build unless trivially achievable without risking the timeline. The page may say "PDF export — coming shortly to Full Brief & Investor" only if true at ship time; otherwise omit until it ships.
- When built: server-rendered from the tier-filtered payload (the gating rule), for Full Brief owners (owned postcodes) + Investor (any generated brief). Function budget: 6/12 — room exists.

## Out of scope
Credit pack (5 for £39.99) — deferred until the £149 proves itself. Ad changes — after one clean week of data. Trust-model — done. Guide rewrites — Bradley + Claude chat, separately.

## Verification gates (non-negotiable, in order)
1. Stripe products verified in the LIVE dashboard (IDs, mode, amount) before code references them.
2. TEST MODE end-to-end: sign in → buy (test card) → webhook → entitlement row → full brief served for that postcode → auto-saved in library → OTHER postcodes still gated → quota untouched → repeat-purchase of the same postcode handled sanely (blocked or idempotent — propose which).
3. Anonymous buy attempt → routed through sign-in, then completes correctly.
4. LIVE purchase: real £149, real card, full chain verified, then refunded via Stripe. The refund does NOT need to auto-revoke in v1 — log revocation handling as a ledger item, propose the manual process.
5. Quota: fresh account walls after 2; wall shows both paths.
6. Existing PRO and INV accounts: behaviour identical before/after (grandfathering proven).
7. Harnesses green including the extended payload-grep. Branch → preview → all gates → master. Rollback stated before merge.

## Gate 2 — preview webhook delivery pattern (THE standing method)
Vercel previews are behind Deployment Protection (SSO) and return 401 to Stripe's webhook POST, so a test-mode endpoint pointed at a bare preview URL never runs the function. Gate 2 must exercise the REAL webhook grant (not a seeded brief_purchases row — seeding only proves serving, not delivery). Standing pattern:
- One-time: Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation** → generate token (project-wide, stable across all previews).
- Stripe (TEST mode) → Webhooks → endpoint URL = `https://<current-branch-preview-host>/api/stripe-webhook?x-vercel-protection-bypass=<TOKEN>` (query param — Stripe can't set headers), events `checkout.session.completed` (+ `customer.subscription.deleted`).
- Set Preview-scoped `STRIPE_WEBHOOK_SECRET` to THIS endpoint's signing secret; redeploy preview if newly set.
- Verify via Stripe **Recent Deliveries** (status + response body: `{"granted":true}` = real grant) — the authoritative artifact, not Vercel runtime logs (short retention).
Production LIVE endpoint is `https://www.luxproperty.ai/api/stripe-webhook` (www, never the apex — apex 307-redirects and Stripe won't follow); verified healthy by gate 4.

## Ledger (fast-follow, own sessions)
- HIGH — Webhook reconciliation from succeeded PaymentIntents: a periodic/backfill grant from Stripe `succeeded` PIs carrying `metadata.kind=full_brief`+`outcode`+`userId`, idempotent on session id, so a missed/failed webhook is never a silently unpaid-for purchase.
- PDF export (already staged above).
