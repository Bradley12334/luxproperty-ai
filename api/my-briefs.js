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
 *   account (carried_briefs), and clears the cookie so it isn't claimed twice.
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
import { readAnonState, clearAnonCookie } from "../lib/auth/anon-cookie.js";

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
    if (!anon.postcode) {
      return res.status(200).json({ ok: true, claimed: null });
    }
    const { ok, outcode } = await saveCarriedBrief(session.sub, anon.postcode);
    // Clear the cookie either way: once linked (or if the postcode was unusable) it must
    // not be re-claimed on a later sign-in. The account now owns the record of it.
    res.setHeader("Set-Cookie", clearAnonCookie());
    return res.status(200).json({ ok: true, claimed: ok ? outcode : null });
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
