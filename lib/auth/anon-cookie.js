/**
 * lib/auth/anon-cookie.js
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ANONYMOUS SOFT-GATE COOKIE — a server-set, HMAC-signed, HttpOnly cookie that
 * records "this anonymous visitor has used their one free brief" (and which postcode
 * it was, for carry-over on sign-up).
 *
 * WHY A SIGNED SERVER COOKIE, NOT localStorage:
 *   The count MUST NOT be editable client-side. localStorage is trivially reset from
 *   devtools; a bare cookie can be hand-edited. This cookie is:
 *     - HttpOnly  → JavaScript cannot read or write it at all.
 *     - Signed    → HMAC-SHA256 over the payload with SESSION_SECRET, so even a user
 *                   who inspects the cookie cannot forge a different count.
 *   Tampering (any byte changed) fails verification and is treated as "no cookie".
 *   Clearing the cookie is still possible (incognito, clear-cookies) — that abuse
 *   vector is what the per-IP hard cap (lib/brief/anon-limit.js) backstops.
 *
 * FORMAT (mirrors the session token): base64url(JSON(payload)) + "." + base64url(HMAC).
 *   payload = { v: 1, n: <freeBriefsUsed>, pc: <postcode|"">, ts: <unix seconds> }
 *
 * FAIL OPEN on absent secret: if SESSION_SECRET is missing we cannot sign/verify, so
 * readAnonState() reports a fresh visitor and buildAnonCookie() returns null (no
 * Set-Cookie). Net effect: the soft gate is simply inert and anonymous briefs are
 * unmetered — exactly today's behaviour — never an over-block. Logged loudly.
 *
 * This module NEVER touches auth, plans, entitlement, or the session token. It shares
 * only the SESSION_SECRET value for signing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";

export const ANON_COOKIE_NAME = "lux_anon";
// Chrome/Firefox cap persistent cookies at ~400 days; the soft gate is effectively
// permanent per visitor, so we ask for the maximum.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

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
 * Parse a raw Cookie header into a plain object. Returns {} for absent/garbage input.
 * @param {string|string[]|undefined} header  req.headers.cookie
 * @returns {Record<string,string>}
 */
export function parseCookies(header) {
  const raw = Array.isArray(header) ? header.join(";") : header;
  if (typeof raw !== "string" || !raw) return {};
  const out = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (!k) continue;
    let v = part.slice(eq + 1).trim();
    try { v = decodeURIComponent(v); } catch { /* keep raw */ }
    out[k] = v;
  }
  return out;
}

/**
 * Read and VERIFY the anonymous-state cookie from a request.
 * @param {import('http').IncomingMessage} req
 * @returns {{ used: number, postcode: string|null }}  fresh visitor (used:0) on
 *   absent / tampered / unverifiable cookie.
 */
export function readAnonState(req) {
  const key = secret();
  if (!key) {
    console.warn("[anon-cookie] SESSION_SECRET absent — cannot verify soft-gate cookie (treating visitor as fresh).");
    return { used: 0, postcode: null };
  }
  const token = parseCookies(req?.headers?.cookie)[ANON_COOKIE_NAME];
  if (typeof token !== "string" || token.indexOf(".") === -1) return { used: 0, postcode: null };

  const dot = token.indexOf(".");
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64 || sigB64.indexOf(".") !== -1) return { used: 0, postcode: null };

  const expected = sign(payloadB64, key);
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { used: 0, postcode: null };

  let payload;
  try {
    payload = JSON.parse(b64urlDecodeToString(payloadB64));
  } catch {
    return { used: 0, postcode: null };
  }
  const used = Number.isFinite(payload?.n) && payload.n > 0 ? Math.floor(payload.n) : 0;
  const postcode = typeof payload?.pc === "string" && payload.pc.trim() ? payload.pc.trim() : null;
  return { used, postcode };
}

/**
 * Build a signed Set-Cookie value recording the anonymous visitor's state.
 * @param {{ used: number, postcode?: string|null }} state
 * @param {number} [nowSeconds]  injectable for tests
 * @returns {string|null}  a Set-Cookie header value, or null if SESSION_SECRET is absent.
 */
export function buildAnonCookie(state, nowSeconds = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key) {
    console.warn("[anon-cookie] SESSION_SECRET absent — not issuing soft-gate cookie (anonymous stays unmetered).");
    return null;
  }
  const used = Number.isFinite(state?.used) && state.used > 0 ? Math.floor(state.used) : 0;
  const pc = typeof state?.postcode === "string" && state.postcode.trim() ? state.postcode.trim().slice(0, 12) : "";
  const payload = { v: 1, n: used, pc, ts: nowSeconds };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const token = `${payloadB64}.${sign(payloadB64, key)}`;
  return serialize(ANON_COOKIE_NAME, token, MAX_AGE_SECONDS);
}

/** Build a Set-Cookie value that expires the anonymous cookie (used after carry-over). */
export function clearAnonCookie() {
  return serialize(ANON_COOKIE_NAME, "", 0);
}

/** Serialize one cookie with the security flags the gate depends on. */
function serialize(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",       // JS cannot read/write — the whole point
    "Secure",         // https only (production + Vercel previews are https)
    "SameSite=Lax",   // sent on same-origin brief/my-briefs fetches; not cross-site
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}
