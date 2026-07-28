/**
 * api/my-briefs.js — Vercel serverless function (the account "My briefs" library)
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth: Authorization: Bearer <session token>  (server-verified; NO client userId)
 *
 * GET /api/my-briefs
 *   The signed-in account's library:
 *     → 200 { ok: true, briefs: [{ outcode, postcode, grantedAt }],   // OWNED Full Briefs
 *                        carried: [{ outcode, postcode, createdAt }] } // CARRIED-OVER anon briefs
 *     → 200 { ok: true, briefs: [], carried: [] }                     anonymous / invalid token
 *   `briefs` are paid ownership (brief_purchases); `carried` are free bookmarks
 *   (carried_briefs) an anonymous visitor generated before signing up. Carried entries
 *   whose district is already OWNED are omitted (ownership supersedes the bookmark).
 *
 * POST /api/my-briefs  (action=claim)
 *   Carry-over hook, called by the client right after sign-up/sign-in. Reads the signed
 *   HttpOnly `lux_anon` cookie (the anonymous brief's postcode), links it to the verified
 *   account (carried_briefs), and RE-SETS the cookie as consumed (used=1) — never clears
 *   it, so signing out can't yield a fresh anonymous free brief.
 *     → 200 { ok: true, claimed: "E8" | null }
 *
 * WHY A SERVER ENDPOINT: brief_purchases / carried_briefs are service-role-only (RLS on,
 * no policies), and the anon cookie is HttpOnly — neither is readable by the browser.
 * Identity comes ONLY from the verified session token; a client-supplied userId is not
 * part of the contract.
 *
 * ENTITLEMENT IS UNTOUCHED: carried_briefs is a bookmark, never ownership. This endpoint
 * only reads brief_purchases (via listOwnedBriefs); it never writes it and never grants a plan.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { verifySessionToken, bearerFromHeader } from "../lib/auth/session-token.js";
import { listOwnedBriefs } from "../lib/brief/ownership.js";
import { listCarriedBriefs, saveCarriedBrief } from "../lib/brief/carried-briefs.js";
import { readAnonState, buildAnonCookie } from "../lib/auth/anon-cookie.js";

export default async function handler(req, res) {
  const session = verifySessionToken(bearerFromHeader(req.headers.authorization));

  // ── POST: claim an anonymous carry-over into the signed-in account ───────────
  if (req.method === "POST") {
    res.setHeader("Cache-Control", "no-store");
    if (!session?.sub) {
      // No account to attach to — nothing to claim (never an error; the client fires
      // this best-effort after auth and ignores the result).
      return res.status(200).json({ ok: true, claimed: null });
    }
    const anon = readAnonState(req);
    let claimed = null;
    if (anon.postcode) {
      const { ok, outcode } = await saveCarriedBrief(session.sub, anon.postcode);
      if (ok) claimed = outcode;
    }
    // Re-set the cookie as CONSUMED — never CLEAR it. Clearing would let the visitor sign
    // out and immediately get a fresh anonymous free brief (the bypass loop). We keep
    // used=1 (and the postcode, so a later sign-in re-claim stays idempotent) so the
    // anonymous allowance remains spent across sign-out. Only touch the cookie if one
    // exists — a sign-up with no anonymous brief keeps its untouched (still-unused) state.
    if (anon.used >= 1 || anon.postcode) {
      const consumed = buildAnonCookie({ used: 1, postcode: anon.postcode || "" });
      if (consumed) res.setHeader("Set-Cookie", consumed);
    }
    return res.status(200).json({ ok: true, claimed });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ── GET: the library (owned + carried) ──────────────────────────────────────
  res.setHeader("Cache-Control", "no-store");
  if (!session?.sub) {
    // Anonymous / invalid token → empty library (never leaks anyone else's).
    return res.status(200).json({ ok: true, briefs: [], carried: [] });
  }

  const [briefs, carriedAll] = await Promise.all([
    listOwnedBriefs(session.sub),
    listCarriedBriefs(session.sub),
  ]);

  // Ownership supersedes a bookmark: don't show a carried entry for a district the
  // account already owns outright (it's already in `briefs`).
  const ownedOutcodes = new Set(briefs.map((b) => String(b.outcode || "").toUpperCase()));
  const carried = carriedAll.filter((c) => !ownedOutcodes.has(String(c.outcode || "").toUpperCase()));

  return res.status(200).json({ ok: true, briefs, carried });
}
