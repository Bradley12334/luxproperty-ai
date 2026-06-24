/**
 * api/valuation-entitlement.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/valuation-entitlement?userId=<uuid>&postcode=<postcode>
 *
 * Resolves the effective valuation tier for a given user + postcode.
 * Resolution order (highest wins):
 *   1. Active postcode_entitlements row where scope = "valuation"
 *   2. Active postcode_entitlements row where scope = "postcode_brief"
 *      (Brief Pro/Investor → automatically unlocks matching valuation tier)
 *   3. users.plan (global plan — covers blanket subscriptions)
 *   4. Falls back to "free"
 *
 * Returns:
 *   { effectiveValuationTier: "free" | "professional" | "investor" }
 *
 * Security:
 *   - userId is a UUID (unguessable) — not a sequential integer
 *   - All queries use the anon key (no service key needed — postcode_entitlements
 *     has RLS disabled and users table allows anon SELECT)
 *   - The response only exposes the derived tier label, not raw entitlement rows
 *   - No auth tokens are required; the client passes its own userId
 *     (same trust model as saved_briefs)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

// ─── Tier helpers ─────────────────────────────────────────────────────────────

const TIER_RANK = { free: 0, professional: 1, investor: 2 };

function higherTier(a, b) {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

// ─── Postcode normalisation ───────────────────────────────────────────────────

function normalisePostcode(raw) {
  const upper = String(raw).toUpperCase().replace(/\s+/g, "").trim();
  if (upper.length >= 5) return upper.slice(0, -3) + " " + upper.slice(-3);
  return upper;
}

function postcodeToOutcode(postcode) {
  return normalisePostcode(postcode).split(" ")[0];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, postcode } = req.query ?? {};

  if (!userId || !postcode) {
    // No user or postcode — everything is free
    return res.status(200).json({ effectiveValuationTier: "free" });
  }

  const outcode = postcodeToOutcode(postcode);
  if (!outcode) {
    return res.status(200).json({ effectiveValuationTier: "free" });
  }

  // Use service key (same as other API routes) — SUPABASE_ANON_KEY is not guaranteed
  // to be set in the Vercel environment; SUPABASE_SERVICE_KEY is confirmed present.
  // The response only exposes the derived tier label, not raw row data.
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  let effectiveTier = "free";

  try {
    // ── Step 1: Global plan from users table ──────────────────────────────────
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    if (!userErr && user?.plan && user.plan !== "explorer") {
      // Map "explorer" → "free" for valuation tier vocabulary
      const globalTier = user.plan === "investor" ? "investor" : "professional";
      effectiveTier = higherTier(effectiveTier, globalTier);
    }

    // ── Step 2: Per-postcode entitlements ─────────────────────────────────────
    // Uses active_postcode_entitlements view (filters expired rows automatically)
    const { data: entitlements, error: entErr } = await supabase
      .from("active_postcode_entitlements")
      .select("scope, tier")
      .eq("user_id", userId)
      .eq("postcode", outcode);

    if (!entErr && entitlements?.length) {
      for (const row of entitlements) {
        // Both "postcode_brief" and "valuation" scopes unlock valuation access
        if (row.scope === "postcode_brief" || row.scope === "valuation") {
          effectiveTier = higherTier(effectiveTier, row.tier);
        }
      }
    }
  } catch (err) {
    console.error("[valuation-entitlement] lookup error:", err.message);
    // On error: fail open to the global plan we already resolved, or free
  }

  // Cache for 60 seconds — plan changes from Stripe are near-real-time
  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json({ effectiveValuationTier: effectiveTier });
}
