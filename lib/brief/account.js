/**
 * lib/brief/account.js
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PLAN-READ BOUNDARY for the brief pipeline.
 *
 * The brief READS the user's plan through the SAME mechanism every other
 * production route uses (see api/valuation-entitlement.js): the client passes its
 * own `userId` (an unguessable UUID minted by api/auth-email.js and cached in
 * localStorage["lux_session"]); the server looks up `users.plan` with the
 * service-role key. There is NO auth token / JWT in this product — this module
 * does not introduce one, and it never writes plans, billing, or auth state.
 *
 * `users.plan` is a CHECK-constrained column with exactly three values:
 *   'explorer' | 'professional' | 'investor'   (default 'explorer')
 * mapped here to the brief's tier vocabulary EXP / PRO / INV.
 *
 * ANONYMOUS (no userId): resolves to EXP (Explorer). Per the product decision,
 * anonymous visitors get unlimited Explorer-tier SECTIONS (the funnel), and the
 * 3-briefs/month quota is enforced only for signed-in accounts (there is no
 * reliable per-user key for a logged-out visitor). Quota lives in Step 3; this
 * module only resolves identity → tier.
 *
 * FAIL CLOSED: any lookup error resolves to EXP (least privilege). A transient DB
 * blip therefore shows a paying user the free tier until they retry — safe, never
 * an over-grant. Logged loudly so it is never silent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

/** @typedef {"EXP"|"PRO"|"INV"} Tier */

/**
 * Pure mapper: a `users.plan` string → brief tier. Unknown/absent → EXP.
 * @param {string|null|undefined} plan
 * @returns {Tier}
 */
export function tierFromPlan(plan) {
  switch (plan) {
    case "investor":
      return "INV";
    case "professional":
      return "PRO";
    // 'explorer', null, undefined, or anything unexpected → free tier.
    default:
      return "EXP";
  }
}

/**
 * Resolve the effective account context for a brief request.
 *
 * @param {string|null|undefined} userId  the client-supplied UUID (or absent for anonymous)
 * @returns {Promise<{ tier: Tier, plan: string|null, userId: string|null, authenticated: boolean }>}
 */
export async function resolveAccountTier(userId) {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) {
    // Anonymous visitor — Explorer sections, no account, no quota.
    return { tier: "EXP", plan: null, userId: null, authenticated: false };
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.warn("[brief/account] SUPABASE_URL/SERVICE_KEY absent — resolving EXP (fail closed).");
    return { tier: "EXP", plan: null, userId: id, authenticated: false };
  }

  try {
    // Service key mirrors api/valuation-entitlement.js: the anon key is not
    // guaranteed set in Vercel; the service key is confirmed present. We read only
    // the plan column and expose only the derived tier — no raw row leaves here.
    const supabase = createClient(url, serviceKey);
    const { data: user, error } = await supabase
      .from("users")
      .select("plan")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn(`[brief/account] plan lookup error for ${id}: ${error.message} — resolving EXP (fail closed).`);
      return { tier: "EXP", plan: null, userId: id, authenticated: true };
    }
    if (!user) {
      // Unknown userId (deleted account, or a stale/forged id) — treat as anonymous
      // for entitlement, but keep the id so quota still counts if it later resolves.
      return { tier: "EXP", plan: null, userId: id, authenticated: false };
    }

    return { tier: tierFromPlan(user.plan), plan: user.plan ?? null, userId: id, authenticated: true };
  } catch (err) {
    console.warn(`[brief/account] plan lookup threw for ${id}: ${err?.message || err} — resolving EXP (fail closed).`);
    return { tier: "EXP", plan: null, userId: id, authenticated: true };
  }
}
