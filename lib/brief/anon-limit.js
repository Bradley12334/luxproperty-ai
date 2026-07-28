/**
 * lib/brief/anon-limit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ANONYMOUS BRIEF HARD LIMIT — a per-IP daily cap that backstops the soft gate.
 *
 * This is ANTI-ABUSE, not the product gate. The product gate is the one-free-brief
 * soft gate (lib/auth/anon-cookie.js). This cap sits WELL ABOVE normal use (10/day)
 * to blunt someone cycling the cookie (incognito / clear-cookies) to farm briefs.
 *
 * PRIVACY: we hash the IP (HMAC-SHA256 keyed by SESSION_SECRET) and store only the
 * hash — the raw IP never touches the database. Backed by public.anon_brief_limits
 * via the atomic bump_anon_brief_limit() function (see brief-anon-limits-migration.sql),
 * which also does opportunistic TTL cleanup so the table stays bounded.
 *
 * FAIL OPEN: any error (no client, RPC failure, missing IP) resolves to "not blocked".
 * A counter blip must never wall a legitimate visitor; the soft gate is the real gate.
 * Uses the service-role key (mirrors account.js / quota.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/** Anonymous generations allowed per IP per UTC day before the hard cap trips. */
export const DAILY_IP_CAP = 10;

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Best-effort client IP from the proxy headers Vercel sets. `x-forwarded-for` is a
 * comma list (client first); we take the first entry, falling back to x-real-ip and
 * the socket. Returns "" when nothing is resolvable.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function clientIp(req) {
  const h = req?.headers || {};
  const xff = h["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : typeof xff === "string" ? xff.split(",")[0] : "";
  const ip = (first || h["x-real-ip"] || req?.socket?.remoteAddress || "").toString().trim();
  return ip;
}

/**
 * One-way, stable hash of an IP. HMAC-keyed by SESSION_SECRET when present (so the
 * hash can't be reversed via a rainbow table of the IPv4 space); a fixed app salt
 * otherwise. Empty input → "".
 * @param {string} ip
 * @returns {string}  hex digest, or "" for empty input.
 */
export function hashIp(ip) {
  const value = String(ip || "").trim();
  if (!value) return "";
  const key = process.env.SESSION_SECRET;
  if (typeof key === "string" && key.length >= 16) {
    return crypto.createHmac("sha256", key).update(value).digest("hex");
  }
  // No secret: still hash (a counter only needs a stable key), with a fixed salt.
  return crypto.createHash("sha256").update("lux-anon-ip:" + value).digest("hex");
}

/** UTC day key, 'YYYY-MM-DD'. */
export function dayKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Record one anonymous generation for this request's IP and report whether the daily
 * hard cap is now exceeded. Counts the CURRENT attempt (so the Nth+1 call trips it).
 *
 * @param {import('http').IncomingMessage} req
 * @param {Date} [now]
 * @returns {Promise<{ blocked: boolean, count: number }>}  blocked:false on any error
 *   (fail open) or when the IP can't be resolved.
 */
export async function bumpAndCheckIp(req, now = new Date()) {
  const ipHash = hashIp(clientIp(req));
  if (!ipHash) return { blocked: false, count: 0 };

  const supabase = serviceClient();
  if (!supabase) {
    console.warn("[brief/anon-limit] Supabase unavailable — skipping IP cap (fail open).");
    return { blocked: false, count: 0 };
  }

  try {
    const { data, error } = await supabase.rpc("bump_anon_brief_limit", {
      p_ip_hash: ipHash,
      p_day: dayKey(now),
    });
    if (error) {
      console.warn(`[brief/anon-limit] bump error: ${error.message} — fail open.`);
      return { blocked: false, count: 0 };
    }
    const count = Number.isFinite(data) ? data : Number(data) || 0;
    return { blocked: count > DAILY_IP_CAP, count };
  } catch (err) {
    console.warn(`[brief/anon-limit] bump threw: ${err?.message || err} — fail open.`);
    return { blocked: false, count: 0 };
  }
}
