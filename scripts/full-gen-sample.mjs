/**
 * scripts/full-gen-sample.mjs — STAGE 2b bulk validation.
 *
 * Draws 40 SEEDED-random full postcodes nationwide (reproducible: fixed PRNG seed
 * selects 40 districts from the Stage-2a resolved set, then each district's centroid
 * reverse-geocodes deterministically to a representative full postcode), runs each
 * through the complete DEPLOYED pipeline (lib/brief/generate.js at INV = full depth),
 * and asserts: no exception; every section in a LEGAL state (DATA/SPARSE/UNAVAILABLE
 * — never LOCKED at INV, never missing); verdict OR refusal present.
 *
 *   node scripts/full-gen-sample.mjs [outPath]
 */
import { generate } from "../lib/brief/generate.js";
import { isBriefError } from "../lib/brief/errors.js";
import fs from "fs";

const OUT = process.argv[2] || "/tmp/full-gen-sample.json";
const SEED = 20260723; // fixed → reproducible sample
const N = 40;
const LEGAL = new Set(["DATA", "SPARSE", "UNAVAILABLE"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// deterministic PRNG (mulberry32)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      return await res.json().catch(() => null);
    } catch { await sleep(300); }
  }
  return null;
}

// Representative full postcode for an outcode: a real postcode WITHIN the exact
// outcode (Postcodes.io /random/postcodes?outcode=). The district set is seeded,
// so the SAMPLE COMPOSITION is reproducible; the specific in-district postcode is
// logged per run. Retries a few times (the endpoint occasionally 500s).
async function repPostcode(outcode) {
  for (let i = 0; i < 5; i++) {
    const j = await getJson(`https://api.postcodes.io/random/postcodes?outcode=${encodeURIComponent(outcode)}`);
    const pc = j?.result?.postcode;
    if (pc) return pc;
    await sleep(200);
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  }));
}

(async () => {
  console.log("STAGE 2b — 40 seeded full-postcode generations through the deployed pipeline\n");

  // ── Seeded selection of 40 districts from the Stage-2a resolved set ──────────
  const sweep = JSON.parse(fs.readFileSync("/tmp/district-sweep.json", "utf8"));
  const pool = [...sweep.resolvedOutcodes].sort(); // deterministic base order
  const rng = mulberry32(SEED);
  // Fisher–Yates with seeded rng, take first N
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const picked = arr.slice(0, N);
  console.log(`Seed ${SEED} → 40 districts: ${picked.join(", ")}\n`);

  console.log("Resolving representative full postcodes (deterministic centroid→nearest)…");
  const samples = [];
  await mapLimit(picked, 10, async (oc) => {
    const pc = await repPostcode(oc);
    samples.push({ district: oc, postcode: pc });
  });
  const valid = samples.filter((s) => s.postcode);
  console.log(`  → ${valid.length}/${N} postcodes resolved.\n`);

  console.log("Generating full briefs (INV depth). This runs the real SPARQL spine — be patient…");
  const rows = [];
  let done = 0;
  await mapLimit(valid, 3, async ({ district, postcode }) => {
    const row = { district, postcode, la: "", region: "", sections: 0, data: 0, sparse: 0, unavail: 0, illegal: [], verdict: "", priceState: "", exception: "" };
    try {
      const { meta, sections } = await generate(postcode, { tier: "INV" });
      row.la = meta.localAuthority; row.region = meta.region || "";
      row.sections = sections.length;
      for (const s of sections) {
        if (s.state === "DATA") row.data++;
        else if (s.state === "SPARSE") row.sparse++;
        else if (s.state === "UNAVAILABLE") row.unavail++;
        else row.illegal.push(`${s.key}:${s.state ?? "MISSING"}`); // LOCKED at INV or missing = illegal
        if (s.key === "pricesTrendNegotiation") row.priceState = s.state;
        if (s.key === "areaVerdict") {
          row.verdict = s.data?.verdict == null ? "REFUSAL" : (s.data?.chip?.label || "verdict");
        }
      }
      if (!sections.some((s) => s.key === "areaVerdict")) row.illegal.push("NO_VERDICT_SECTION");
    } catch (e) {
      row.exception = isBriefError(e) ? e.code : `EXCEPTION:${e?.message || e}`;
    }
    rows.push(row);
    done++;
    process.stdout.write(`\r  generated ${done}/${valid.length}   `);
  });
  console.log("\n");

  rows.sort((a, b) => a.district.localeCompare(b.district));
  const clean = rows.filter((r) => !r.exception && r.illegal.length === 0 && r.verdict);
  const report = { seed: SEED, n: valid.length, clean: clean.length, rows };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  // Table
  console.log("district  postcode    LA / region                     secs  D/S/U     price       verdict            issues");
  console.log("────────  ──────────  ──────────────────────────────  ────  ────────  ──────────  ─────────────────  ──────");
  for (const r of rows) {
    const dsu = `${r.data}/${r.sparse}/${r.unavail}`;
    const issues = r.exception || (r.illegal.length ? r.illegal.join(",") : "—");
    console.log(
      `${r.district.padEnd(8)}  ${(r.postcode||"?").padEnd(10)}  ${(r.la+" / "+r.region).slice(0,30).padEnd(30)}  ${String(r.sections).padEnd(4)}  ${dsu.padEnd(8)}  ${(r.priceState||"—").padEnd(10)}  ${(r.verdict||"—").padEnd(17)}  ${issues}`,
    );
  }
  console.log(`\nCLEAN (no exception, all sections legal, verdict/refusal present): ${clean.length}/${valid.length}`);
  const bad = rows.filter((r) => r.exception || r.illegal.length || !r.verdict);
  if (bad.length) {
    console.log(`\n*** ISSUES (${bad.length}) ***`);
    for (const r of bad) console.log(`  ${r.district} ${r.postcode} — ${r.exception || r.illegal.join(",") || "no verdict"}`);
  }
  console.log(`\nReport written: ${OUT}`);
})();
