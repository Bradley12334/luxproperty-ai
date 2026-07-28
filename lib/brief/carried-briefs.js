/**
 * lib/brief/carried-briefs.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CARRY-OVER STORE — the read/write layer over public.carried_briefs (an
 * anonymous visitor's free brief, linked to their account on sign-up).
 *
 *   saveCarriedBrief(userId, postcode)  → best-effort insert (idempotent per outcode)
 *   listCarriedBriefs(userId)           → [{ postcode, outcode, createdAt }]
 *
 * SEPARATION (critical): this is a BOOKMARK, never entitlement. ownsFullBrief() reads
 * brief_purchases ONLY and never consults this table, so carrying a brief over unlocks
 * nothing — it regenerates at the account's normal plan tier. It is also distinct from
 * the Investor portfolio (public.saved_briefs), which this module never touches.
 *
 * FAIL SOFT: writes are best-effort (never throw — a carry-over blip must not break
 * sign-up); reads return [] on any error. Uses the service-role key (brief_* pattern).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { outcodeOf } from "./ownership.js";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn("[brief/carried] SUPABASE_URL/SERVICE_KEY absent — carry-over disabled (no-op).");
    return null;
  }
  return createClient(url, key);
}

/**
 * Link an anonymous brief to an account. Idempotent on (user_id, outcode): re-claiming
 * the same district is a silent no-op, not an error. Never throws.
 * @param {string} userId
 * @param {string} postcode  the anon-generated postcode or outcode
 * @returns {Promise<{ ok: boolean, outcode: string }>}
 */
export async function saveCarriedBrief(userId, postcode) {
  const id = typeof userId === "string" ? userId.trim() : "";
  const pc = typeof postcode === "string" ? postcode.trim() : "";
  const outcode = outcodeOf(pc);
  if (!id || !outcode) return { ok: false, outcode: "" };

  const supabase = client();
  if (!supabase) return { ok: false, outcode };

  try {
    const { error } = await supabase
      .from("carried_briefs")
      .upsert(
        { user_id: id, postcode: pc, outcode },
        { onConflict: "user_id,outcode", ignoreDuplicates: true },
      );
    if (error) {
      console.warn(`[brief/carried] save error for ${id}/${outcode}: ${error.message} — sign-up unaffected.`);
      return { ok: false, outcode };
    }
    return { ok: true, outcode };
  } catch (err) {
    console.warn(`[brief/carried] save threw for ${id}/${outcode}: ${err?.message || err} — sign-up unaffected.`);
    return { ok: false, outcode };
  }
}

/**
 * The carried-over briefs for an account, most-recent first, deduped by outcode.
 * @param {string|null|undefined} userId
 * @returns {Promise<Array<{ postcode: string, outcode: string, createdAt: string }>>}  [] on any error.
 */
export async function listCarriedBriefs(userId) {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return [];
  const supabase = client();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("carried_briefs")
      .select("postcode, outcode, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn(`[brief/carried] list error for ${id}: ${error.message} — returning [].`);
      return [];
    }
    const seen = new Set();
    const out = [];
    for (const row of data ?? []) {
      const oc = String(row.outcode || "").toUpperCase();
      if (oc && !seen.has(oc)) {
        seen.add(oc);
        out.push({
          postcode: String(row.postcode || "").toUpperCase() || oc,
          outcode: oc,
          createdAt: String(row.created_at || ""),
        });
      }
    }
    return out;
  } catch (err) {
    console.warn(`[brief/carried] list threw for ${id}: ${err?.message || err} — returning [].`);
    return [];
  }
}
