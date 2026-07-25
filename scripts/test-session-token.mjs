/**
 * scripts/test-session-token.mjs
 * Unit + adversarial coverage for lib/auth/session-token.js — the identity primitive.
 * Run: SESSION_SECRET=... node scripts/test-session-token.mjs
 * (auto-sets a test secret if none provided).
 */
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-please-use-a-real-one-in-prod-0123456789";

import {
  mintSessionToken,
  verifySessionToken,
  bearerFromHeader,
  DEFAULT_TTL_SECONDS,
} from "../lib/auth/session-token.js";

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

const NOW = 1_800_000_000; // fixed unix seconds (Date.now is not used — injected)
const UID = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

console.log("1. round-trip: a minted token verifies to its subject");
{
  const t = mintSessionToken(UID, NOW);
  const v = verifySessionToken(t, NOW);
  check("mint returns a token", typeof t === "string" && t.includes("."));
  check("verify recovers sub", v && v.sub === UID);
  check("exp is iat + TTL", v && v.exp === NOW + DEFAULT_TTL_SECONDS);
}

console.log("2. (check c) forged/garbage/tampered tokens → null, never throw");
{
  check("garbage string → null", verifySessionToken("not-a-token", NOW) === null);
  check("empty → null", verifySessionToken("", NOW) === null);
  check("null → null", verifySessionToken(null, NOW) === null);
  check("missing signature → null", verifySessionToken("onlypayload", NOW) === null);

  // Tamper the payload but keep the old signature → signature mismatch.
  const t = mintSessionToken(UID, NOW);
  const [, sig] = t.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ sub: OTHER, iat: NOW, exp: NOW + 1000 }))
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  check("swapped payload, old sig → null", verifySessionToken(`${forgedPayload}.${sig}`, NOW) === null);

  // Signature signed with the WRONG secret → mismatch.
  const goodPayload = t.split(".")[0];
  const badSig = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  check("wrong signature → null", verifySessionToken(`${goodPayload}.${badSig}`, NOW) === null);
}

console.log("3. (check c) expired token → null");
{
  const t = mintSessionToken(UID, NOW, 100); // expires at NOW+100
  check("valid just before exp", verifySessionToken(t, NOW + 99)?.sub === UID);
  check("null exactly at exp", verifySessionToken(t, NOW + 100) === null);
  check("null after exp", verifySessionToken(t, NOW + 1000) === null);
}

console.log("4. (check b) a token for user A never resolves to user B");
{
  const tA = verifySessionToken(mintSessionToken(UID, NOW), NOW);
  check("sub is exactly A, not B", tA.sub === UID && tA.sub !== OTHER);
  // There is no code path that lets an external userId override sub — sub is the token's.
}

console.log("5. fail-closed: absent SESSION_SECRET → no mint, no verify");
{
  const saved = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  check("mint → null without secret", mintSessionToken(UID, NOW) === null);
  // A token minted WITH a secret must not verify once the secret is gone.
  process.env.SESSION_SECRET = saved;
  const t = mintSessionToken(UID, NOW);
  delete process.env.SESSION_SECRET;
  check("verify → null without secret", verifySessionToken(t, NOW) === null);
  process.env.SESSION_SECRET = saved;
}

console.log("6. bearerFromHeader parsing");
{
  check("extracts token", bearerFromHeader("Bearer abc.def") === "abc.def");
  check("case-insensitive scheme", bearerFromHeader("bearer abc.def") === "abc.def");
  check("array header (first)", bearerFromHeader(["Bearer xyz"]) === "xyz");
  check("no scheme → null", bearerFromHeader("abc.def") === null);
  check("undefined → null", bearerFromHeader(undefined) === null);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
