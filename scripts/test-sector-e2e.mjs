/**
 * scripts/test-sector-e2e.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * END-TO-END assertion on the REAL brief handler with a REAL postcode.
 *
 * WHY THIS EXISTS — the harness gap it closes:
 *   Three defects in the sector-divergence work passed every existing test and
 *   failed in production. All three were at a BOUNDARY, and every harness entered
 *   the pipeline below the boundary by constructing the object the next layer
 *   expected:
 *     1. applySectorPolicy lived inside spineFromAggregate; the harness built its
 *        own spine and never ran it.
 *     2. ResolvedLocation has no `sector` field, so `location.sector ?? null` was
 *        always null and the policy could never fire. The harness supplied a sector
 *        directly, so it never exercised the step that derives one.
 *     3. gate.js rebuilds the negotiation object from an explicit field list that
 *        omitted `withheld`, dropping the explanation below PRO. Any assertion made
 *        on the pre-gate section object misses this entirely.
 *
 *   The generalisation: A TEST THAT CONSTRUCTS THE INPUT CANNOT DETECT A BUG IN
 *   CONSTRUCTING THE INPUT. So this file constructs nothing. It hands the handler a
 *   postcode STRING and asserts on the JSON the client actually receives — after
 *   resolve, sector derivation, the aggregate read, the policy, section building,
 *   tier gating and serialisation.
 *
 * TWO CASES, because a positive alone proves nothing. A mutation that fires the warn
 * band on every request would pass the positive and fail the negative:
 *   E20 3BE  sector E20 3, n=76, +25.2% divergence against a ±6.1% error bar → WARN
 *   E20 1HT  sector E20 1, n=1172, -0.4% divergence, inside its error bar   → NONE
 *
 * MODES
 *   node scripts/test-sector-e2e.mjs
 *     In-process: imports api/brief.js and calls it with a mock req/res. Needs
 *     SUPABASE_URL + SUPABASE_SERVICE_KEY and TX_SOURCE/TX_AGG_DISTRICTS in env.
 *   node scripts/test-sector-e2e.mjs --url https://<deployment>
 *     Over HTTP against a real deployment — the strongest form, and the only one
 *     that also proves the deployed env vars are actually in effect.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const WARN_POSTCODE = "E20 3BE";   // sector E20 3 — the divergent one
const NONE_POSTCODE = "E20 1HT";   // sector E20 1 — the in-line one
const urlArg = process.argv.indexOf("--url");
const BASE = urlArg !== -1 ? process.argv[urlArg + 1] : null;
const shareArg = process.argv.indexOf("--share");
const SHARE = shareArg !== -1 ? process.argv[shareArg + 1] : null;
const shaArg = process.argv.indexOf("--expect-sha");
const EXPECT_SHA = shaArg !== -1 ? process.argv[shaArg + 1] : null;

/** Real figures for the warn case, read from the aggregate — NOT from a fixture.
 *  Asserting the exact numbers is what stops a synthetic median passing for the real
 *  one: a made-up district median produced +18.6% where the truth is +25.2%, and it
 *  read as plausible because it was formatted like production output. */
const EXPECT = {
  districtMedian: 592000,
  sectorMedian: 741250,
  sectorCount: 76,
  sectorCiLo: 680000,
  sectorCiHi: 770000,
  divergencePctRounded: 25.2,
};

/** Vercel SSO-protected previews answer 307 to an auth handshake that sets a cookie.
 *  fetch follows the redirect but does not carry Set-Cookie across it, so the
 *  handshake is done once here and the cookie reused for the real requests. */
let sessionCookie = null;
async function authenticate() {
  if (!SHARE || sessionCookie) return;
  const res = await fetch(`${BASE.replace(/\/$/, "")}/?_vercel_share=${SHARE}`, { redirect: "manual" });
  const raw = res.headers.getSetCookie?.() || [];
  sessionCookie = raw.map((c) => c.split(";")[0]).join("; ") || null;
  if (!sessionCookie) console.log("   (no bypass cookie returned — the preview may be public)");
}

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail = "") {
  if (ok) { passed++; console.log(`   ✓ ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`   ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`); }
}

/** Fetch a brief the way a browser would, or by invoking the handler in-process. */
async function getBrief(postcode) {
  if (BASE) {
    await authenticate();
    const res = await fetch(`${BASE.replace(/\/$/, "")}/api/brief?postcode=${encodeURIComponent(postcode)}`, {
      headers: { Accept: "application/json", ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
    });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; }
    catch { return { status: res.status, body: null, raw: text.slice(0, 400) }; }
  }

  const { default: handler } = await import("../api/brief.js");
  // Minimal Vercel-shaped req/res. Deliberately NOT a reimplementation of the
  // handler's logic — it only captures what the handler writes.
  const req = { method: "GET", query: { postcode }, headers: {}, cookies: {} };
  let status = 200;
  let body = null;
  const res = {
    statusCode: 200,
    setHeader() { return res; },
    status(c) { status = c; res.statusCode = c; return res; },
    json(v) { body = v; return res; },
    send(v) { body = typeof v === "string" ? safeParse(v) : v; return res; },
    end(v) { if (v && body == null) body = safeParse(String(v)); return res; },
  };
  await handler(req, res);
  return { status, body };
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

/** Pull the price section out of the payload the client receives. */
function priceSection(body) {
  const sections = body?.sections || body?.brief?.sections || [];
  return sections.find((s) => s.key === "pricesTrendNegotiation") || null;
}

const bar = "─".repeat(78);

console.log(`\n${"═".repeat(78)}`);
console.log(`SECTOR DIVERGENCE — END-TO-END, through the real handler`);
console.log(`${"═".repeat(78)}`);
console.log(`mode: ${BASE ? `HTTP against ${BASE}` : "in-process (api/brief.js)"}`);
if (EXPECT_SHA) console.log(`expecting build: ${EXPECT_SHA}`);

// ── POSITIVE: the warn band must fire ────────────────────────────────────────
console.log(`\n▶ ${WARN_POSTCODE} — sector E20 3, +25.2% divergence, 4.2x its error bar\n${bar}`);
{
  const { status, body, raw } = await getBrief(WARN_POSTCODE);
  check("handler returned 200", status === 200, `got ${status}${raw ? ` — ${raw}` : ""}`);

  // WHICH BUILD, WHICH PATH — asserted before anything else, so a pass can never be
  // reported against a deployment other than the one under test.
  const meta = body?.meta || {};
  console.log(`   · build ${meta.build?.commit?.slice(0, 8) ?? "unknown"} (${meta.build?.ref ?? "?"}/${meta.build?.env ?? "?"}) · spine "${meta.spineSource ?? "?"}"`);
  if (EXPECT_SHA) {
    check(`deployment is ${EXPECT_SHA.slice(0, 8)}`, (meta.build?.commit || "").startsWith(EXPECT_SHA),
      `served by ${meta.build?.commit ?? "unknown"}`);
  }
  check("price spine came from the aggregate", meta.spineSource === "aggregate", `got ${JSON.stringify(meta.spineSource)}`);
  check("sector resolved from the full postcode", meta.sector === "E20 3", `got ${JSON.stringify(meta.sector)}`);

  const sec = priceSection(body);
  check("price section present", !!sec, sec ? "" : "no pricesTrendNegotiation in payload");

  if (sec) {
    check("served from the aggregate (asOf present)", !!sec.asOf?.published,
      `asOf=${JSON.stringify(sec.asOf)} — null means the SPARQL path served this`);
    check("sectorVerdict === 'warn'", sec.sectorVerdict === "warn", `got ${JSON.stringify(sec.sectorVerdict)}`);
    check("sectorNote is non-empty", typeof sec.sectorNote === "string" && sec.sectorNote.length > 40,
      `got ${JSON.stringify(sec.sectorNote)}`);
    check("sectorNote names the sector", /E20 3/.test(sec.sectorNote || ""));

    // The note PROMISES the sector's own median is stated. The previous suite checked
    // only the note, so it passed while £741,250 appeared nowhere on the page. A
    // promise in copy is not evidence that the thing promised is rendered.
    const fig = sec.sectorFigure;
    check("sectorFigure is present", !!fig, "the withholding copy promises this figure is shown");
    check("sector median is the real figure", fig?.median?.raw === EXPECT.sectorMedian,
      `expected ${EXPECT.sectorMedian}, got ${fig?.median?.raw}`);
    check("sector sale count is stated", fig?.count === EXPECT.sectorCount, `expected ${EXPECT.sectorCount}, got ${fig?.count}`);
    check("sector CI is the aggregate's, not a symmetric invention",
      fig?.range?.low === EXPECT.sectorCiLo && fig?.range?.high === EXPECT.sectorCiHi,
      `expected ${EXPECT.sectorCiLo}-${EXPECT.sectorCiHi}, got ${fig?.range?.low}-${fig?.range?.high}`);
    check("divergence is +25.2% against the real district median",
      Math.abs((fig?.vsDistrict?.pct ?? 0) - EXPECT.divergencePctRounded) < 0.1,
      `expected ~${EXPECT.divergencePctRounded}%, got ${fig?.vsDistrict?.pct}`);
    check("district median is the real one", sec.data?.marketOverview?.windowMedian?.raw === EXPECT.districtMedian,
      `expected ${EXPECT.districtMedian}, got ${sec.data?.marketOverview?.windowMedian?.raw}`);

    const neg = sec.data?.negotiation;
    check("negotiation block present", !!neg);
    check("fairValueRange withheld", neg?.fairValueRange == null, `got ${JSON.stringify(neg?.fairValueRange)}`);
    check("openingRange withheld", neg?.openingRange == null, `got ${JSON.stringify(neg?.openingRange)}`);
    // This is the assertion that catches the gate dropping the field on the way out.
    check("negotiation.withheld survives gating", typeof neg?.withheld === "string" && neg.withheld.length > 40,
      `got ${JSON.stringify(neg?.withheld)}`);
    check("withheld copy says the omission is deliberate", /deliberate/i.test(neg?.withheld || ""));
  }
}

// ── NEGATIVE: an in-line sector must NOT fire ────────────────────────────────
console.log(`\n▶ ${NONE_POSTCODE} — sector E20 1, -0.4% divergence, inside its error bar\n${bar}`);
{
  const { status, body, raw } = await getBrief(NONE_POSTCODE);
  check("handler returned 200", status === 200, `got ${status}${raw ? ` — ${raw}` : ""}`);
  const sec = priceSection(body);
  check("price section present", !!sec);

  if (sec) {
    check("served from the aggregate (asOf present)", !!sec.asOf?.published);
    check("sectorVerdict is not 'warn'", sec.sectorVerdict !== "warn", `got ${JSON.stringify(sec.sectorVerdict)}`);
    check("no sectorNote", !sec.sectorNote, `got ${JSON.stringify(sec.sectorNote)}`);
    check("no sectorFigure", !sec.sectorFigure, `an in-line sector must not get its own headline figure — got ${JSON.stringify(sec.sectorFigure?.median?.raw)}`);

    const neg = sec.data?.negotiation;
    // Without this the suite would pass against code that withholds unconditionally.
    check("fairValueRange IS shown", neg?.fairValueRange != null, "an in-line sector must still get its ranges");
    check("openingRange IS shown", neg?.openingRange != null);
    check("nothing withheld", neg?.withheld == null, `got ${JSON.stringify(neg?.withheld)}`);
  }
}

console.log(`\n${bar}`);
console.log(`${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`\nFAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("");
process.exit(failed ? 1 : 0);
