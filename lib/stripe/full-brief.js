/**
 * lib/stripe/full-brief.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for the £149 one-off "Full Brief" Stripe price, shared
 * by api/create-checkout.js (builds the checkout line item) and api/stripe-webhook.js
 * (identifies a completed payment session as a Full Brief before granting).
 *
 * MODE-SPECIFIC IDs (the prod_UKur… lesson — see stripe-webhook.js): a price created
 * in a test-mode sandbox has a different id from the live one. Resolution is:
 *   1. STRIPE_PRICE_FULLBRIEF env var — set this PER Vercel environment:
 *        • Preview / Development → the TEST-sandbox price id (required; the live
 *          default below is useless against a test key → "No such price")
 *        • Production            → the LIVE price id (optional; the default covers it)
 *   2. Built-in LIVE default — verified against acct_1TMEwHP7AaxWnYG2 on 2026-07-25,
 *      so production keeps working with no env var set.
 *
 * There is deliberately NO test default: a missing env var on preview must fail loudly
 * as "No such price", never silently charge against the wrong environment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { normalizePostcode } from "../brief/resolve.js";

/**
 * The live Full Brief price — Product "Full Brief" (prod_Ux3xSXVFlXSRC0).
 *
 * !! PRICE CUTOVER PENDING (£14.99 → £149) !!
 * The id below is still the OLD £14.99 price object. Stripe prices are immutable in
 * `unit_amount`, so the £149 change is a NEW price on the same product — this constant
 * MUST be replaced with that new live id before this branch reaches master, or live
 * checkout will charge £14.99 while every surface quotes £149.
 */
const LIVE_FULLBRIEF_PRICE = "price_1Tx9pyP7AaxWnYG279sDjqxQ";

/** The configured Full Brief price id for THIS environment (env override → live default). */
export function fullBriefPriceId() {
  const env = process.env.STRIPE_PRICE_FULLBRIEF;
  return (typeof env === "string" && env.trim()) ? env.trim() : LIVE_FULLBRIEF_PRICE;
}

/**
 * Derive the grantFullBrief() arguments from a completed Checkout Session — the SAME
 * fields, read the SAME way, as api/stripe-webhook.js → handleFullBriefPurchase(). Pure
 * (one optional normalizePostcode call, no network), so the reconciler can replay a
 * missed webhook with byte-identical semantics.
 *
 * DELIBERATELY not wired into the webhook: the webhook path must stay untouched. This
 * helper exists so the reconciler never drifts from the webhook's derivation.
 *
 *   userId         ← session.client_reference_id (the verified account; the webhook's key)
 *   outcode        ← metadata.outcode, fallback normalizePostcode(metadata.postcode).outcode
 *   postcode       ← metadata.postcode ?? null   (display/routing only)
 *   stripeSessionId← session.id                  (THE idempotency key — identical to the
 *                                                 webhook's brief_purchases.stripe_session_id)
 *
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @returns {{ userId: string|null, outcode: string, postcode: string|null,
 *             stripeSessionId: string, amountPaid: number|null, currency: string|null }}
 */
export function fullBriefGrantArgsFromSession(session) {
  const userId = session?.client_reference_id || null;

  let outcode = String(session?.metadata?.outcode || "").toUpperCase().replace(/\s+/g, "").trim();
  if (!outcode && session?.metadata?.postcode) {
    try { outcode = normalizePostcode(session.metadata.postcode).outcode; } catch { /* leave empty */ }
  }

  return {
    userId,
    outcode,
    postcode: session?.metadata?.postcode ?? null,
    stripeSessionId: session?.id || "",
    amountPaid: session?.amount_total ?? null,
    currency: session?.currency ?? null,
  };
}

/**
 * Is a Stripe Checkout Session a Full Brief purchase?
 * Primary signal: mode === "payment" AND a line item whose price is the configured id.
 * Fallback: session.metadata.kind === "full_brief" (set by create-checkout) or the
 * product carries metadata.plan === "full_brief" — belt-and-braces if the price id
 * map is ever stale in a new mode.
 *
 * @param {import("stripe").Stripe.Checkout.Session} session
 * @param {import("stripe").Stripe.ApiList<import("stripe").Stripe.LineItem>|null} lineItems
 * @returns {boolean}
 */
export function sessionIsFullBrief(session, lineItems) {
  if (!session || session.mode !== "payment") return false;

  const wantPrice = fullBriefPriceId();
  const items = lineItems?.data ?? [];
  for (const item of items) {
    if (item?.price?.id && item.price.id === wantPrice) return true;
  }

  // Fallbacks (metadata-based) — never the primary path, but they keep a genuine
  // Full Brief resolvable if the price id is misconfigured for the current mode.
  const kind = String(session.metadata?.kind || "").toLowerCase();
  if (kind === "full_brief") return true;

  return false;
}
