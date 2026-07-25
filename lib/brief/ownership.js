/**
 * lib/brief/ownership.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FULL BRIEF OWNERSHIP — the read/write layer over public.brief_purchases (the
 * £14.99 one-off, per-outcode permanent purchase).
 *
 *   ownsFullBrief(userId, outcode)  → boolean  (does this account own this district?)
 *   grantFullBrief({...})           → records a purchase, idempotent on stripe_session_id
 *   listOwnedOutcodes(userId)       → string[] (the "My briefs" library backing)
 *
 * SEPARATION: this is the ONE-OFF ownership layer. It never reads or writes users.plan
 * (subscriptions) and never touches postcode_entitlements (the Valuation product). A
 * Full Brief unlocks the brief for its outcode and nothing else — by design.
 *
 * GRANULARITY: outcode (district), matching lib/brief/resolve.js → location.outcode
 * and meta.outcode. The caller normalises to outcode; this module compares uppercased.
 *
 * FAIL CLOSED on reads: any lookup error → NOT owned (false), logged loudly. A DB blip
 * therefore shows a paying owner the gated brief until they retry — safe (never an
 * over-grant), consistent with account.js. Uses the service-role key (bypasses RLS;
 * brief_purchases is service-role only).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn("[brief/ownership] SUPABASE_URL/SERVICE_KEY absent — treating as not-owned (fail closed).");
    return null;
  }
  return createClient(url, key);
}

/** Uppercase, trimmed outcode key. Empty string for junk input. */
function normOutcode(outcode) {
  return typeof outcode === "string" ? outcode.toUpperCase().replace(/\s+/g, "").trim() : "";
}

/**
 * Derive the ownership key (outcode) from a raw postcode string — SYNCHRONOUSLY, no
 * network. This must agree with lib/brief/resolve.js → location.outcode (what the brief
 * displays as meta.outcode and what create-checkout stores), so the ownership check in
 * api/brief.js (which runs BEFORE generation, before meta.outcode exists) keys the same
 * district. It does, because a UK incode is always 3 chars, so outcode = "everything but
 * the last 3" for a full postcode, and the whole string for a bare outcode.
 *
 *   "e8 1ng" → "E8"   |   "sw1a 1aa" → "SW1A"   |   "E8" → "E8"   |   "" → ""
 *
 * @param {string|null|undefined} rawPostcode
 * @returns {string}  uppercase outcode, or "" for junk.
 */
export function outcodeOf(rawPostcode) {
  const compact = String(rawPostcode || "").toUpperCase().replace(/\s+/g, "");
  // Bare outcode (area + district, no incode): "E8", "SW1A", "EC1A".
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact)) return compact;
  // Full postcode: outcode is all but the 3-char incode.
  if (compact.length >= 5) return compact.slice(0, -3);
  return "";
}

/**
 * Does `userId` own the Full Brief for `outcode`?
 * @param {string|null|undefined} userId
 * @param {string|null|undefined} outcode
 * @returns {Promise<boolean>}  false on absent input OR any error (fail closed).
 */
export async function ownsFullBrief(userId, outcode) {
  const id = typeof userId === "string" ? userId.trim() : "";
  const oc = normOutcode(outcode);
  if (!id || !oc) return false;

  const supabase = client();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from("brief_purchases")
      .select("id", { head: false })
      .eq("user_id", id)
      .eq("outcode", oc)
      .limit(1);
    if (error) {
      console.warn(`[brief/ownership] ownsFullBrief lookup error for ${id}/${oc}: ${error.message} — not-owned (fail closed).`);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.warn(`[brief/ownership] ownsFullBrief threw for ${id}/${oc}: ${err?.message || err} — not-owned (fail closed).`);
    return false;
  }
}

/**
 * Record a Full Brief purchase. Idempotent on stripe_session_id (Stripe retries the
 * webhook), so a replayed event is a no-op, not a duplicate row or an error.
 *
 * @param {Object} p
 * @param {string} p.userId
 * @param {string} p.outcode
 * @param {string} p.stripeSessionId  the Checkout Session id (unique idempotency key)
 * @param {number|null} [p.amountPaid] pence (session.amount_total)
 * @param {string|null} [p.currency]
 * @returns {Promise<{ ok: boolean, duplicate: boolean }>}
 * @throws if the DB is unreachable or errors for a NON-duplicate reason — the webhook
 *         turns that into a 500 so Stripe retries (never lose a paid grant).
 */
export async function grantFullBrief({ userId, outcode, stripeSessionId, amountPaid = null, currency = null }) {
  const id = String(userId || "").trim();
  const oc = normOutcode(outcode);
  const sid = String(stripeSessionId || "").trim();
  if (!id || !oc || !sid) {
    throw new Error(`grantFullBrief: missing required field (userId=${!!id}, outcode=${!!oc}, sessionId=${!!sid})`);
  }

  const supabase = client();
  if (!supabase) throw new Error("grantFullBrief: Supabase client unavailable");

  const { error } = await supabase
    .from("brief_purchases")
    .insert({ user_id: id, outcode: oc, stripe_session_id: sid, amount_paid: amountPaid, currency });

  if (error) {
    // 23505 = unique_violation on stripe_session_id → the webhook already granted this
    // exact session (Stripe retry). That is SUCCESS, not a failure.
    if (error.code === "23505") return { ok: true, duplicate: true };
    throw new Error(`grantFullBrief insert failed: ${error.message}`);
  }
  return { ok: true, duplicate: false };
}

/**
 * The Full Briefs this account owns — the "My briefs" library, most-recent first,
 * one entry per distinct outcode (the earliest grant date is kept if somehow a
 * district was granted twice).
 * @param {string|null|undefined} userId
 * @returns {Promise<Array<{ outcode: string, grantedAt: string }>>}  [] on absent input or any error.
 */
export async function listOwnedBriefs(userId) {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return [];
  const supabase = client();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("brief_purchases")
      .select("outcode, granted_at")
      .eq("user_id", id)
      .order("granted_at", { ascending: false });
    if (error) {
      console.warn(`[brief/ownership] listOwnedBriefs error for ${id}: ${error.message} — returning [].`);
      return [];
    }
    // Distinct by outcode, preserving most-recent-first order.
    const seen = new Set();
    const out = [];
    for (const row of data ?? []) {
      const oc = normOutcode(row.outcode);
      if (oc && !seen.has(oc)) { seen.add(oc); out.push({ outcode: oc, grantedAt: row.granted_at }); }
    }
    return out;
  } catch (err) {
    console.warn(`[brief/ownership] listOwnedBriefs threw for ${id}: ${err?.message || err} — returning [].`);
    return [];
  }
}

/**
 * The distinct outcodes this account owns (thin wrapper over listOwnedBriefs).
 * @param {string|null|undefined} userId
 * @returns {Promise<string[]>}  [] on absent input or any error.
 */
export async function listOwnedOutcodes(userId) {
  return (await listOwnedBriefs(userId)).map((b) => b.outcode);
}
