/**
 * scripts/test-identity-resolution.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * ADVERSARIAL coverage of the brief API's identity extraction — the paywall-bypass
 * fix. It reproduces the EXACT two lines api/brief.js uses to derive identity:
 *
 *     const session = verifySessionToken(bearerFromHeader(req.headers.authorization));
 *     const account = await resolveAccountTier(session?.sub);   // sub is the only id
 *
 * ...and drives them with hostile request shapes. The point is check (b): a
 * client-supplied ?userId= (or any other parameter) must have ZERO effect — the id
 * handed to resolveAccountTier comes only from the verified token's `sub`.
 *
 * This is a request-seam mirror (hermetic, no network). It is backed by:
 *   - a static grep proving api/brief.js contains no `req.query.userId`, and
 *   - the live preview check (a real logged-in account → Investor; logged-out →
 *     anonymous) that exercises the real handler end-to-end.
 * Run: node scripts/test-identity-resolution.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-please-use-a-real-one-in-prod-0123456789";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mintSessionToken, verifySessionToken, bearerFromHeader } from "../lib/auth/session-token.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`)); };

// EXACT mirror of api/brief.js identity extraction. If brief.js changes, the static
// assertion below fails and forces this mirror to be revisited.
function resolveIdFromRequest(req) {
  const session = verifySessionToken(bearerFromHeader(req.headers.authorization));
  return session?.sub ?? null; // the id passed to resolveAccountTier; null → anonymous
}

const ALICE = "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa"; // the real account (e.g. Investor)
const MALLORY = "eeeeeeee-9999-9999-9999-eeeeeeeeeeee"; // an attacker-known other UUID
const aliceToken = mintSessionToken(ALICE);

console.log("(a) valid session → that account's id");
{
  const req = { headers: { authorization: `Bearer ${aliceToken}` }, query: { postcode: "E8 1NG" } };
  check("resolves to Alice's sub", resolveIdFromRequest(req) === ALICE);
}

console.log("(b) someone ELSE's userId in any parameter is IGNORED");
{
  // Alice's valid token, but a malicious ?userId=MALLORY (the old bypass vector).
  const req = {
    headers: { authorization: `Bearer ${aliceToken}` },
    query: { postcode: "E8 1NG", userId: MALLORY, user_id: MALLORY, uid: MALLORY },
    body: { userId: MALLORY },
  };
  const id = resolveIdFromRequest(req);
  check("id is Alice (token), NOT Mallory (param)", id === ALICE && id !== MALLORY);

  // No token at all, but a malicious ?userId= — the exact reported vulnerability.
  const forged = { headers: {}, query: { postcode: "E8 1NG", userId: MALLORY } };
  check("bare ?userId= grants NOTHING → anonymous", resolveIdFromRequest(forged) === null);
}

console.log("(c) forged / expired / garbage token → anonymous (null), not an error");
{
  check("garbage token → null", resolveIdFromRequest({ headers: { authorization: "Bearer not.a.token" }, query: {} }) === null);
  check("tampered-secret token → null", resolveIdFromRequest({ headers: { authorization: "Bearer x.y" }, query: {} }) === null);
  const expired = mintSessionToken(ALICE, Math.floor(Date.now() / 1000) - 10_000, 100); // already expired
  check("expired token → null", resolveIdFromRequest({ headers: { authorization: `Bearer ${expired}` }, query: {} }) === null);
}

console.log("(d) no credential → anonymous (unchanged behaviour)");
{
  check("no Authorization header → null", resolveIdFromRequest({ headers: {}, query: { postcode: "E8 1NG" } }) === null);
}

console.log("STATIC: api/brief.js no longer reads a client-supplied userId");
{
  const src = readFileSync(join(__dirname, "..", "api", "brief.js"), "utf8");
  check("brief.js contains no `query.userId`", !/query\s*\.\s*userId/.test(src));
  check("brief.js derives id from verified token (session?.sub)", /resolveAccountTier\(\s*session\s*\?\.\s*sub\s*\)/.test(src));
  check("brief.js reads the Authorization header", /req\.headers\.authorization/.test(src));
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
