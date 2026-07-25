/**
 * lib/auth/session-token.js
 * ─────────────────────────────────────────────────────────────────────────────
 * STATELESS, HMAC-SIGNED SESSION TOKENS — the server-verifiable identity this app
 * previously lacked. Until now the only identity assertion was a bare `users.id`
 * UUID passed as `?userId=` (a non-expiring bearer credential sent in GET query
 * strings — logged, refererred, and forgeable by anyone who learns the UUID).
 *
 * A token is minted at sign-in (api/auth-email.js) AFTER the password is verified,
 * and verified on each API request (api/brief.js). The verified `sub` is the ONLY
 * source of identity; the client-supplied userId parameter is deleted, not trusted.
 *
 * FORMAT (compact, dependency-free — signed with the `crypto` module only):
 *     token = base64url(JSON({ sub, iat, exp })) + "." + base64url(HMAC-SHA256(payload, secret))
 * This is a minimal JWS/JWT-shaped token but intentionally NOT a Supabase Auth JWT:
 * these users live in public.users (custom bcrypt auth), not auth.users, so
 * supabase.auth.getUser() cannot verify them. We sign with our OWN secret.
 *
 * SECRET: process.env.SESSION_SECRET — a long random string provisioned on the
 * production functions. FAIL CLOSED: if it is absent, mint returns null (no token
 * issued) and verify returns null (no identity granted) — the caller degrades to
 * the anonymous Explorer path, never an over-grant. Both log loudly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";

/** Default token lifetime — 30 days. lux_session persists in localStorage, so a
 *  long-lived token matches the product's "stay signed in" behaviour; expiry still
 *  bounds the blast radius of a leaked token, which the raw UUID never did. */
export const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  return typeof s === "string" && s.length >= 16 ? s : null;
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToString(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function sign(payloadB64, key) {
  return b64urlEncode(crypto.createHmac("sha256", key).update(payloadB64).digest());
}

/**
 * Mint a signed session token for a verified user id.
 * @param {string} sub  the authenticated users.id (verified by password already)
 * @param {number} [nowSeconds]  unix seconds (injectable for tests)
 * @param {number} [ttlSeconds]
 * @returns {string|null}  the token, or null if SESSION_SECRET is absent (fail closed).
 */
export function mintSessionToken(sub, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = DEFAULT_TTL_SECONDS) {
  const key = secret();
  if (!key) {
    console.warn("[session-token] SESSION_SECRET absent — cannot mint token (user will be anonymous).");
    return null;
  }
  if (typeof sub !== "string" || !sub) return null;
  const payload = { sub, iat: nowSeconds, exp: nowSeconds + ttlSeconds };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, key)}`;
}

/**
 * Verify a session token and return its payload, or null if invalid/expired/absent.
 * Constant-time signature comparison; never throws.
 * @param {string|null|undefined} token
 * @param {number} [nowSeconds]  unix seconds (injectable for tests)
 * @returns {{ sub: string, iat: number, exp: number }|null}
 */
export function verifySessionToken(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key) {
    console.warn("[session-token] SESSION_SECRET absent — cannot verify token (treating as anonymous).");
    return null;
  }
  if (typeof token !== "string" || token.indexOf(".") === -1) return null;

  const dot = token.indexOf(".");
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64 || sigB64.indexOf(".") !== -1) return null;

  // Recompute and compare in constant time.
  const expected = sign(payloadB64, key);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;
  if (typeof payload.exp !== "number" || nowSeconds >= payload.exp) return null; // expired

  return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
}

/**
 * Extract a Bearer token from an Authorization header value.
 * @param {string|string[]|undefined} headerValue
 * @returns {string|null}
 */
export function bearerFromHeader(headerValue) {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1].trim() : null;
}
