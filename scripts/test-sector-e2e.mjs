/**
 * scripts/test-sector-e2e.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * END-TO-END assertion on the REAL brief handler with REAL postcodes, one per
 * branch the sector classifier can take.
 *
 * WHY THIS EXISTS — the harness gaps it closes:
 *   Defects in this work repeatedly passed every test and failed in production,
 *   always at a boundary, because each harness entered the pipeline BELOW the
 *   boundary by constructing the object the next layer expected:
 *     · applySectorPolicy lived inside spineFromAggregate; the harness built its
 *       own spine and never ran it.
 *     · ResolvedLocation had no `sector`, so `location.sector ?? null` was always
 *       null and the policy could never fire. The harness supplied a sector.
 *     · gate.js rebuilt the negotiation object from a field list that omitted
 *       `withheld`. Assertions on the pre-gate object miss that entirely.
 *     · A report quoted +18.6% and a symmetric CI from a synthetic fixture, both
 *       formatted like production output.
 *     · The serve band shipped claiming "figures are for the sector" while every
 *       figure stayed district-derived — and NO test covered it, because E20 has
 *       two sectors and neither is a serve case.
 *
 *   Two rules follow, and this file enforces both:
 *     1. A TEST THAT CONSTRUCTS THE INPUT CANNOT DETECT A BUG IN CONSTRUCTING IT.
 *        So this file constructs nothing: postcode strings in, served JSON out.
 *     2. A TEST THAT COVERS THE CASES YOU THOUGHT OF CANNOT DETECT A BRANCH YOU
 *        DIDN'T. So it asserts the verdicts exercised equal SECTOR_VERDICTS
 *        exactly — add a branch and the suite fails until a real postcode covers it.
 *
 * CASES — expected values read from the aggregate, never from a fixture:
 *   CR0 2AB  CR0 2, n=2,454, -14.2% vs ±1.2%  → warn   (largest district; exposed the serve bug)
 *   E20 3BE  E20 3, n=76,    +25.2% vs ±6.1%  → warn   (thin but decisive)
 *   E20 1HT  E20 1, n=1,172, -0.4%  vs ±1.3%  → none   (inside its own error bar)
 *   LL78 8JJ LL78 8, n=82,   -3.8%  vs ±4.4%  → none   (+ district below the 100-sale floor)
 *
 * MODES
 *   node scripts/test-sector-e2e.mjs --url https://<deployment> --share <token> --expect-sha <sha>
 *   node scripts/test-sector-e2e.mjs      (in-process; needs SUPABASE_* + TX_* in env)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REPO_SECTOR_VERDICTS = (await import("../lib/brief/tx-agg.js")).SECTOR_VERDICTS;

const urlArg = process.argv.indexOf("--url");
const BASE = urlArg !== -1 ? process.argv[urlArg + 1] : null;
const shareArg = process.argv.indexOf("--share");
const SHARE = shareArg !== -1 ? process.argv[shareArg + 1] : null;
const shaArg = process.argv.indexOf("--expect-sha");
const EXPECT_SHA = shaArg !== -1 ? process.argv[shaArg + 1] : null;

/** One case per branch. Figures are the aggregate's actual values — asserting them
 *  exactly is what stops a synthetic median passing for the real one. */
const CASES = [
  {
    postcode: "CR0 2AB", sector: "CR0 2", verdict: "warn",
    districtMedian: 352500, districtCount: 16713,
    sectorMedian: 302600, sectorCount: 2454, ciLo: 300000, ciHi: 307000, divergence: -14.2,
    belowFloor: false,
  },
  {
    postcode: "E20 3BE", sector: "E20 3", verdict: "warn",
    districtMedian: 592000, districtCount: 1248,
    sectorMedian: 741250, sectorCount: 76, ciLo: 680000, ciHi: 770000, divergence: 25.2,
    belowFloor: false,
  },
  {
    postcode: "E20 1HT", sector: "E20 1", verdict: "none",
    districtMedian: 592000, districtCount: 1248,
    sectorMedian: 589500, sectorCount: 1172, divergence: -0.4,
    belowFloor: false,
  },
  {
    postcode: "LL78 8JJ", sector: "LL78 8", verdict: "none",
    districtMedian: null, districtCount: 90,
    sectorMedian: 228500, sectorCount: 82, divergence: -3.8,
    belowFloor: true, // district has 90 sales — under the 100-sale floor, no median stated
  },
];

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
console.log(`SECTOR DIVERGENCE — END-TO-END, every branch, through the real handler`);
console.log(`${"═".repeat(78)}`);
console.log(`mode: ${BASE ? `HTTP against ${BASE}` : "in-process (api/brief.js)"}`);
if (EXPECT_SHA) console.log(`expecting build: ${EXPECT_SHA}`);
console.log(`branches the classifier can emit: ${REPO_SECTOR_VERDICTS.join(", ")}`);

const verdictsSeen = new Set();

for (const c of CASES) {
  console.log(`\n▶ ${c.postcode} — sector ${c.sector}, ${c.divergence > 0 ? "+" : ""}${c.divergence}% → expect "${c.verdict}"${c.belowFloor ? " (district below the 100-sale floor)" : ""}\n${bar}`);
  const { status, body, raw } = await getBrief(c.postcode);
  check(`${c.postcode}: handler returned 200`, status === 200, `got ${status}${raw ? ` — ${raw}` : ""}`);
  if (status !== 200) continue;

  const meta = body?.meta || {};
  console.log(`   · build ${meta.build?.commit?.slice(0, 8) ?? "unknown"} (${meta.build?.ref ?? "?"}/${meta.build?.env ?? "?"}) · spine "${meta.spineSource ?? "?"}"`);
  if (EXPECT_SHA) {
    check(`${c.postcode}: deployment is ${EXPECT_SHA.slice(0, 8)}`, (meta.build?.commit || "").startsWith(EXPECT_SHA),
      `served by ${meta.build?.commit ?? "unknown"}`);
  }
  check(`${c.postcode}: spine is the aggregate`, meta.spineSource === "aggregate", `got ${JSON.stringify(meta.spineSource)}`);
  check(`${c.postcode}: sector derived from the postcode`, meta.sector === c.sector, `got ${JSON.stringify(meta.sector)}`);

  const sec = priceSection(body);
  check(`${c.postcode}: price section present`, !!sec);
  if (!sec) continue;

  check(`${c.postcode}: dated from source_published`, !!sec.asOf?.published, `got ${JSON.stringify(sec.asOf)}`);

  const verdict = sec.sectorVerdict ?? "none";
  verdictsSeen.add(verdict);
  check(`${c.postcode}: verdict is "${c.verdict}"`, verdict === c.verdict, `got ${JSON.stringify(verdict)}`);
  check(`${c.postcode}: verdict is one the code declares`, REPO_SECTOR_VERDICTS.includes(verdict),
    `"${verdict}" is not in SECTOR_VERDICTS`);

  // ── The grain claim. C removed the serve band: the brief reports DISTRICT
  //    figures and must never say otherwise. This is the assertion that would have
  //    caught CR0 2AB reading "Figures are for postcode sector CR0 2".
  const mo = sec.data?.marketOverview;
  if (!c.belowFloor) {
    check(`${c.postcode}: headline median is the DISTRICT median`, mo?.windowMedian?.raw === c.districtMedian,
      `expected ${c.districtMedian}, got ${mo?.windowMedian?.raw}`);
    check(`${c.postcode}: headline count is the DISTRICT count`, mo?.totalTransactions === c.districtCount,
      `expected ${c.districtCount}, got ${mo?.totalTransactions}`);
  } else {
    check(`${c.postcode}: below-floor district states no median`, mo == null || mo?.windowMedian?.raw == null,
      `expected no median, got ${mo?.windowMedian?.raw}`);
    check(`${c.postcode}: below-floor states its count and range`, sec.data?.priceRange != null || sec.data?.totalTransactions != null);
  }
  check(`${c.postcode}: no copy claims the figures are sector-level`,
    !/figures are for postcode sector|figures are for sector/i.test(JSON.stringify(sec)),
    "the deleted serve-band copy is still being emitted");

  if (verdict === "warn") {
    check(`${c.postcode}: sectorNote present`, typeof sec.sectorNote === "string" && sec.sectorNote.length > 40);
    check(`${c.postcode}: sectorNote names the sector`, (sec.sectorNote || "").includes(c.sector));
    check(`${c.postcode}: sectorNote says figures describe the district`, /describe the whole of|whole of /i.test(sec.sectorNote || ""));

    const fig = sec.sectorFigure;
    check(`${c.postcode}: sectorFigure present`, !!fig, "the note promises this figure is shown");
    check(`${c.postcode}: sector median is the real figure`, fig?.median?.raw === c.sectorMedian,
      `expected ${c.sectorMedian}, got ${fig?.median?.raw}`);
    check(`${c.postcode}: sector count stated`, fig?.count === c.sectorCount, `expected ${c.sectorCount}, got ${fig?.count}`);
    check(`${c.postcode}: sector CI is the aggregate's, not an invention`,
      fig?.range?.low === c.ciLo && fig?.range?.high === c.ciHi,
      `expected ${c.ciLo}-${c.ciHi}, got ${fig?.range?.low}-${fig?.range?.high}`);
    check(`${c.postcode}: divergence matches the aggregate`,
      Math.abs((fig?.vsDistrict?.pct ?? 0) - c.divergence) < 0.1, `expected ~${c.divergence}%, got ${fig?.vsDistrict?.pct}`);

    const neg = sec.data?.negotiation;
    check(`${c.postcode}: fairValueRange withheld`, neg?.fairValueRange == null);
    check(`${c.postcode}: openingRange withheld`, neg?.openingRange == null);
    check(`${c.postcode}: withheld reason survives gating`, typeof neg?.withheld === "string" && neg.withheld.length > 40,
      `got ${JSON.stringify(neg?.withheld)}`);
    check(`${c.postcode}: withheld copy does not claim too few sector sales`,
      !/not enough evidence to state a sector figure/i.test(neg?.withheld || ""),
      "false for a 2,454-sale sector whose median IS stated");
  } else {
    check(`${c.postcode}: no sectorNote`, !sec.sectorNote, `got ${JSON.stringify(sec.sectorNote)}`);
    check(`${c.postcode}: no sectorFigure`, !sec.sectorFigure, `got ${JSON.stringify(sec.sectorFigure?.median?.raw)}`);
    const neg = sec.data?.negotiation;
    // Absent ranges here are the PRO tier gate, not a sector withholding. `withheld`
    // staying null is what separates the two, and catches unconditional withholding.
    check(`${c.postcode}: nothing withheld for sector reasons`, neg?.withheld == null, `got ${JSON.stringify(neg?.withheld)}`);
  }
}

// ── BRANCH COVERAGE — the rule that would have caught the untested serve band ──
console.log(`\n▶ Branch coverage\n${bar}`);
const declared = [...REPO_SECTOR_VERDICTS].sort();
const exercised = [...verdictsSeen].sort();
console.log(`   declared:  ${declared.join(", ")}`);
console.log(`   exercised: ${exercised.join(", ") || "(none)"}`);
const uncovered = declared.filter((v) => !verdictsSeen.has(v));
check(`every declared verdict has a real-postcode case`, uncovered.length === 0,
  uncovered.length ? `no case covers: ${uncovered.join(", ")} — add one before shipping` : "");
check(`no case produced an undeclared verdict`, exercised.every((v) => declared.includes(v)));

console.log(`\n${bar}`);
console.log(`${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(`\nFAILURES:`);
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("");
process.exit(failed ? 1 : 0);
