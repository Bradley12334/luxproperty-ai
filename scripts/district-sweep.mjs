/**
 * scripts/district-sweep.mjs — STAGE 2a bulk validation.
 *
 * Authoritative grid enumeration: every real England & Wales postcode AREA ×
 * district candidates (0–99 + lettered central-London variants), each run through
 * the RESOLVER (resolve()). Classifies every candidate as RESOLVED, a typed
 * rejection (INVALID_POSTCODE = not a real/geographic district; UNSUPPORTED_NATION),
 * or an UNEXPECTED exception / no-coordinate "NE99-class" anomaly.
 *
 *   node scripts/district-sweep.mjs [outPath]
 *
 * Real districts = RESOLVED ∪ (real-but-rejected). 404s are expected (candidate
 * simply isn't a district) and reported separately, not as failures.
 */
import { resolve } from "../lib/brief/resolve.js";
import { isBriefError } from "../lib/brief/errors.js";
import fs from "fs";

const OUT = process.argv[2] || "/tmp/district-sweep.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// England & Wales postcode AREAS (Scotland / NI / Crown-dependency areas excluded —
// they are not E&W; the resolver would reject them and they aren't the sweep target).
const EW_AREAS = [
  "AL","B","BA","BB","BD","BH","BL","BN","BR","BS","CA","CB","CF","CH","CM","CO",
  "CR","CT","CV","CW","DA","DE","DH","DL","DN","DT","DY","E","EC","EN","EX","FY",
  "GL","GU","HA","HD","HG","HP","HR","HU","HX","IG","IP","KT","L","LA","LD","LE",
  "LL","LN","LS","LU","M","ME","MK","N","NE","NG","NN","NP","NR","NW","OL","OX",
  "PE","PL","PO","PR","RG","RH","RM","S","SA","SE","SG","SK","SL","SM","SN","SO",
  "SP","SR","SS","ST","SW","SY","TA","TF","TN","TQ","TR","TS","TW","UB","W","WA",
  "WC","WD","WF","WN","WR","WS","WV","YO",
];

// Areas that have lettered districts (central London + a handful). We generate
// {area}{1..2}{A..Z} for these, which covers EC1A, WC1H, SW1A, W1A, N1C, E1W…
const LETTERED_AREAS = ["E","EC","N","NW","SE","SW","W","WC","B"];

function candidates() {
  const set = new Set();
  for (const area of EW_AREAS) {
    for (let d = 0; d <= 99; d++) set.add(`${area}${d}`);
  }
  for (const area of LETTERED_AREAS) {
    for (let d = 1; d <= 2; d++) {
      for (let c = 65; c <= 90; c++) set.add(`${area}${d}${String.fromCharCode(c)}`);
    }
  }
  return [...set];
}

async function mapLimit(items, limit, fn, onTick) {
  let i = 0, done = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
      done++;
      if (onTick && done % 250 === 0) onTick(done, items.length);
    }
  });
  await Promise.all(workers);
}

function classify(err) {
  if (isBriefError(err)) return err.code;
  return `EXCEPTION`;
}

(async () => {
  console.log("STAGE 2a — District sweep (authoritative grid → resolver)\n");
  const cands = candidates();
  console.log(`Candidates generated: ${cands.length} (${EW_AREAS.length} E&W areas × 0–99 + lettered)\n`);

  const rows = [];
  await mapLimit(cands, 12, async (oc) => {
    let outcome, detail = "";
    try {
      const loc = await resolve(oc);
      outcome = "RESOLVED";
      detail = `${loc.localAuthority} / ${loc.country}`;
    } catch (e) {
      outcome = classify(e);
      detail = (e?.message || String(e)).slice(0, 90);
    }
    rows.push({ outcode: oc, outcome, detail });
    await sleep(8);
  }, (d, t) => process.stdout.write(`\r  resolving… ${d}/${t}   `));
  console.log("");

  const byOutcome = {};
  for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;

  const resolved = rows.filter((r) => r.outcome === "RESOLVED");
  // "Real district" candidates that did NOT cleanly resolve and are NOT a plain
  // 404-style INVALID_POSTCODE (i.e. genuine anomalies: exceptions or no-coords).
  const anomalies = rows.filter(
    (r) => r.outcome === "EXCEPTION" || r.outcome === "UPSTREAM_ERROR",
  );
  const nationRejects = rows.filter((r) => r.outcome === "UNSUPPORTED_NATION");

  const report = {
    generatedFrom: "Postcodes.io (grid enumeration)",
    candidates: cands.length,
    byOutcome,
    resolvedCount: resolved.length,
    anomalies,
    nationRejects: nationRejects.map((r) => r.outcode),
    resolvedOutcodes: resolved.map((r) => r.outcode).sort(),
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("──────────── SWEEP RESULT ────────────");
  console.log(`Candidates swept: ${cands.length}`);
  for (const [k, v] of Object.entries(byOutcome).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
  console.log(`\nReal E&W districts that RESOLVED cleanly: ${resolved.length}`);
  console.log(`Typed rejections (INVALID_POSTCODE = not a real district / non-geographic): ${byOutcome.INVALID_POSTCODE || 0}`);
  console.log(`Nation rejections (UNSUPPORTED_NATION, border-straddle areas): ${nationRejects.length}${nationRejects.length ? " → " + nationRejects.map(r=>r.outcode).join(",") : ""}`);
  console.log(`\n*** NE99-CLASS ANOMALIES (unexpected exception / no-coords): ${anomalies.length} ***`);
  for (const a of anomalies.slice(0, 60)) console.log(`  ${a.outcode.padEnd(6)} ${a.outcome.padEnd(16)} ${a.detail}`);
  console.log(`\nReport written: ${OUT}`);
})();
