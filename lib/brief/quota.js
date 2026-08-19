/**
 * lib/brief/quota.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER-SIDE BRIEF QUOTA — the Explorer "2 briefs / calendar month" limit.
 *
 * Backed by public.brief_generations (see brief-generations-migration.sql):
 * one row per successful generation. Quota therefore counts GENERATIONS, not data
 * fetches — a warm/cached transaction district still records a row and still
 * consumes quota, so the shared L1/L2 transaction cache never leaks across the
 * quota boundary.
 *
 * SCOPE:
 *   - Signed-in accounts only. Anonymous (no userId) visitors get unlimited
 *     Explorer SECTIONS and no quota (there is no reliable per-user key for a
 *     logged-out visitor — documented product decision). No row is written.
 *   - EXP limit is 2/month; PRO/INV are Infinity (briefsPerMonth() in entitlements).
 *
 * FAIL OPEN (availability over strictness): if the count read errors, we do NOT
 * block the user (returning `exceeded:false`); if the post-generation insert
 * errors, we log loudly but still return the brief. A ledger blip must never eat a
 * paid-for or free-tier brief. Both paths warn so they are never silent.
 *
 * Uses the service-role key (mirrors account.js / valuation-entitlement.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { briefsPerMonth } from "./entitlements.js";

/**
 * UTC calendar-month key, 'YYYY-MM'. Quota resets at the first of each UTC month.
 * @param {Date} date
 * @returns {string}
 */
export function monthKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** First day of the NEXT UTC month as 'YYYY-MM-DD' — the quota reset date for copy. */
export function nextMonthResetISO(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-based
  const next = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  return `${next.y}-${String(next.m + 1).padStart(2, "0")}-01`;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * How many briefs this account has generated in `month`.
 * @param {string} userId
 * @param {string} month  'YYYY-MM'
 * @returns {Promise<number>}  0 on any error (fail open — never blocks).
 */
export async function countGenerations(userId, month) {
  const supabase = client();
  if (!supabase || !userId) return 0;
  try {
    const { count, error } = await supabase
      .from("brief_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("month", month);
    if (error) {
      console.warn(`[brief/quota] count error for ${userId} ${month}: ${error.message} — treating as 0 (fail open).`);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(`[brief/quota] count threw for ${userId} ${month}: ${err?.message || err} — treating as 0.`);
    return 0;
  }
}

/**
 * Record a successful generation (best-effort). Never throws.
 * @param {string} userId
 * @param {string} month   'YYYY-MM'
 * @param {string} outcode audit only (e.g. "E8")
 * @returns {Promise<boolean>} true if the row was written.
 */
export async function recordGeneration(userId, month, outcode) {
  const supabase = client();
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from("brief_generations")
      .insert({ user_id: userId, month, outcode: outcode || "" });
    if (error) {
      console.warn(`[brief/quota] record error for ${userId} ${month}: ${error.message} — brief still returned.`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[brief/quota] record threw for ${userId} ${month}: ${err?.message || err} — brief still returned.`);
    return false;
  }
}

/**
 * Build a quota-status object for the response (funnel display + enforcement).
 * @param {"EXP"|"PRO"|"INV"} tier
 * @param {number} used
 * @param {string} month
 * @param {Date} now
 * @param {boolean} authenticated
 * @returns {{ tier, authenticated, limit: number|null, used: number, remaining: number|null,
 *             unlimited: boolean, exceeded: boolean, month: string, resetsOn: string }}
 */
export function quotaStatus(tier, used, month, now, authenticated) {
  const limit = briefsPerMonth(tier); // 2 | Infinity
  const unlimited = !Number.isFinite(limit);
  return {
    tier,
    authenticated: !!authenticated,
    limit: unlimited ? null : limit,
    used,
    remaining: unlimited ? null : Math.max(0, limit - used),
    unlimited,
    exceeded: !unlimited && used >= limit,
    month,
    resetsOn: nextMonthResetISO(now),
  };
}
