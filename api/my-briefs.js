/**
 * api/my-briefs.js — Vercel serverless function (pricing restructure, Step 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/my-briefs
 * Auth: Authorization: Bearer <session token>  (server-verified; NO client userId)
 *
 * Returns the signed-in account's owned Full Briefs — the "My briefs" library.
 *   → 200 { ok: true, briefs: [{ outcode, grantedAt }] }   (possibly empty)
 *   → 200 { ok: true, briefs: [] }                          anonymous / invalid token
 *
 * WHY A SERVER ENDPOINT: brief_purchases is service-role-only (RLS on, no policies),
 * so the browser cannot read it directly. Identity comes ONLY from the verified
 * session token — a client-supplied userId is not part of the contract.
 *
 * Anonymous or invalid token → an empty library (200, not 401): "My briefs" for a
 * logged-out visitor is simply empty, matching the funnel's other anonymous surfaces.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { verifySessionToken, bearerFromHeader } from "../lib/auth/session-token.js";
import { listOwnedBriefs } from "../lib/brief/ownership.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = verifySessionToken(bearerFromHeader(req.headers.authorization));
  if (!session?.sub) {
    // Anonymous / invalid token → empty library (never leaks anyone else's).
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, briefs: [] });
  }

  const briefs = await listOwnedBriefs(session.sub);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, briefs });
}
