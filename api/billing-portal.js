/**
 * api/billing-portal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/billing-portal   body: { userId, email }
 *
 * Creates a FRESH Stripe Billing Portal session for the signed-in customer and
 * returns its one-time URL, so they can manage payment methods, view invoices,
 * and cancel their subscription themselves.
 *
 * Why this exists:
 *   The account page previously opened a hardcoded, static Stripe portal *login*
 *   link (https://billing.stripe.com/p/login/live_...). That link 404s and is the
 *   wrong mechanism for an already-signed-in user — it is not scoped to the
 *   customer and it goes stale. Portal sessions must be minted per click via the
 *   API against a specific Stripe customer.
 *
 * Customer resolution:
 *   We do not store a stripe_customer_id (the users table has no such column), so
 *   the Stripe customer is resolved from the account's email at click time. This
 *   relies on the Stripe checkout email matching the account email — which the
 *   checkout flow now guarantees by prefilling it. If a customer somehow paid with
 *   a different address, this returns NO_CUSTOMER and the UI tells them to contact
 *   support rather than silently failing.
 *
 * Auth (IMPORTANT — known limitation):
 *   This app has no server-verifiable session token. The established trust model
 *   (see api/valuation-entitlement.js) is that the client passes its own userId.
 *   The billing portal is more sensitive than that model really warrants, so we
 *   require BOTH the userId AND the matching email, and the account must actually
 *   be on a paid plan. That raises the bar but does not eliminate it: anyone who
 *   knows a user's UUID *and* email could still open their portal.
 *   FOLLOW-UP: issue a signed session token at sign-in and verify it here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PAID_PLANS = new Set(["professional", "investor"]);

// Subscription states that mean "this customer has a real billing relationship"
const LIVE_SUB_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

// Only ever send the customer back to our own site.
const ALLOWED_RETURN_HOSTS = /(^|\.)luxproperty\.ai$|\.vercel\.app$/;

function resolveReturnUrl(req) {
  const fallback = "https://www.luxproperty.ai/account";
  const origin =
    req.headers.origin ||
    (req.headers.host ? `https://${req.headers.host}` : "");
  try {
    const url = new URL(origin);
    if (!ALLOWED_RETURN_HOSTS.test(url.hostname)) return fallback;
    return `${url.origin}/account`;
  } catch {
    return fallback;
  }
}

/**
 * Find the Stripe customer for an email. Prefers a customer that actually has a
 * live subscription (a user may have several customer objects over time).
 */
async function findStripeCustomer(stripe, email) {
  let candidates = [];

  // Exact-match list is immediately consistent (search is not), so try it first.
  try {
    const { data } = await stripe.customers.list({ email, limit: 20 });
    candidates = data || [];
  } catch (err) {
    console.error("customers.list failed:", err.message);
  }

  // Fallback: search handles casing/formatting differences.
  if (candidates.length === 0) {
    try {
      const { data } = await stripe.customers.search({
        query: `email:"${email}"`,
        limit: 20,
      });
      candidates = data || [];
    } catch (err) {
      console.error("customers.search failed:", err.message);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer whichever customer holds a live subscription.
  for (const customer of candidates) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });
      if (subs.data.some((s) => LIVE_SUB_STATUSES.has(s.status))) return customer;
    } catch (err) {
      console.error("subscriptions.list failed for", customer.id, err.message);
    }
  }

  // Otherwise the most recently created one.
  return [...candidates].sort((a, b) => b.created - a.created)[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const userId = String(body.userId || "").trim();
  const email = String(body.email || "").toLowerCase().trim();

  if (!userId || !email) {
    return res.status(400).json({ error: "userId and email are required", code: "BAD_REQUEST" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // ── Verify the caller owns this account (userId AND email must agree) ───────
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, email, plan")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    console.error("Supabase user lookup failed:", userErr.message);
    return res.status(500).json({ error: "Lookup failed", code: "DB_ERROR" });
  }
  if (!user || String(user.email).toLowerCase().trim() !== email) {
    // Do not reveal which half was wrong.
    return res.status(403).json({ error: "Not authorised", code: "FORBIDDEN" });
  }
  if (!PAID_PLANS.has(user.plan)) {
    return res.status(403).json({
      error: "No active subscription to manage",
      code: "NOT_SUBSCRIBED",
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-04-10",
  });

  // ── Resolve the Stripe customer ────────────────────────────────────────────
  let customer;
  try {
    customer = await findStripeCustomer(stripe, email);
  } catch (err) {
    console.error("Customer resolution failed:", err.message);
    return res.status(500).json({ error: "Could not reach Stripe", code: "STRIPE_ERROR" });
  }

  if (!customer) {
    console.error(
      "NO STRIPE CUSTOMER for paid account:",
      user.id,
      email,
      "| plan:",
      user.plan,
      "| they may have paid with a different email"
    );
    return res.status(404).json({
      error: "We could not find a Stripe customer for this email.",
      code: "NO_CUSTOMER",
    });
  }

  // ── Mint a fresh portal session ────────────────────────────────────────────
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: resolveReturnUrl(req),
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Stripe throws this when the Customer Portal has never been configured in
    // the dashboard (Settings → Billing → Customer portal). Surface it clearly
    // instead of a generic 500 — this was the original cause of the 404.
    const message = String(err.message || "");
    if (/configuration|customer portal|default settings/i.test(message)) {
      console.error("STRIPE CUSTOMER PORTAL NOT CONFIGURED:", message);
      return res.status(503).json({
        error:
          "The billing portal is not yet configured. Please contact support@luxproperty.ai.",
        code: "PORTAL_NOT_CONFIGURED",
      });
    }
    console.error("billingPortal.sessions.create failed:", message);
    return res.status(500).json({ error: "Could not open billing portal", code: "STRIPE_ERROR" });
  }
}
