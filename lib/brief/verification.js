/**
 * lib/brief/verification.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EMAIL-VERIFICATION READ for the brief gate. Kept SEPARATE from account.js so
 * resolveAccountTier ("accountTier") stays byte-untouched — this only READS
 * users.email_verified, it never writes verification, plan, or auth state.
 *
 * Reuses the verification flow already built in api/auth-email.js (signup sends the
 * confirmation email; /verify-email flips this column). This module just answers
 * "may this account generate?" for api/brief.js.
 *
 * SCHEMA-TOLERANT + FAIL OPEN: if the email_verified column is absent (migration not
 * applied) or the lookup errors, we resolve VERIFIED (true) — never block a legitimate
 * account over a transient DB blip or a pre-migration deployment. A missing column means
 * the flow isn't active yet, which must degrade to "allowed", not "everyone locked out".
 * Uses the service-role key (mirrors account.js / quota.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Is this account's email verified? Only meaningful for signed-in accounts.
 * @param {string|null|undefined} userId  the verified users.id
 * @returns {Promise<boolean>}  true (allowed) on absent input, missing column, unknown
 *   user, or any error (fail open); the real column value otherwise.
 */
export async function isEmailVerified(userId) {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) return true; // no account to gate — anonymous is handled elsewhere

  const supabase = client();
  if (!supabase) {
    console.warn("[brief/verification] Supabase unavailable — treating as verified (fail open).");
    return true;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("email_verified")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      // 42703 / "column ... does not exist" → migration not applied → flow inactive →
      // allow (pre-migration behaviour, matching api/auth-email.js). Any other error →
      // also fail open (availability over strictness), logged.
      console.warn(`[brief/verification] lookup error for ${id}: ${error.message} — treating as verified (fail open).`);
      return true;
    }
    if (!data) return true; // unknown user (stale token) — don't hard-block here
    // Column present → honour it. (null, from a row created before the column existed
    // and never grandfathered, is treated as NOT verified — the strict, correct default.)
    return data.email_verified === true;
  } catch (err) {
    console.warn(`[brief/verification] threw for ${id}: ${err?.message || err} — treating as verified (fail open).`);
    return true;
  }
}
