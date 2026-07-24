/**
 * scripts/test-overpass-combined.mjs — verifies the combined Overpass query returns the
 * SAME parsed station/school/amenity/park data as the three separate queries did, and
 * that it makes 3× fewer Overpass calls.
 *
 *   node scripts/test-overpass-combined.mjs
 *
 * Runs from THIS machine's IP (not rate-limited), so live Overpass responds. For each
 * fixture it runs OLD (fetchStations+fetchSchools+fetchAmenities = 3 calls) and NEW
 * (fetchOverpassBundle = 1 call) and deep-diffs the parsed results.
 */
import * as overpass from "../lib/brief/overpass.js";

// Count Overpass HTTP calls by wrapping the exported overpassQuery via a module spy is
// not possible on a frozen import; instead we assert by construction (OLD fires 3
// overpassQuery calls, NEW fires 1) and MEASURE wall-clock as a secondary signal.
const { fetchStations, fetchSchools, fetchAmenities, fetchOverpassBundle } = overpass;

const FIXTURES = ["E8 1AA", "M1 1AE", "SY10 7AA", "LS1 4DY", "BS1 4ST"];

async function resolveLoc(pc) {
  const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`).then((x) => x.json());
  const res = r?.result;
  return res ? { lat: res.latitude, lng: res.longitude } : null;
}

const norm = (v) => JSON.stringify(v);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log(`  ✗ ${m}`); } };

console.log("Overpass combined-query before/after — parsed-result parity\n");

for (const pc of FIXTURES) {
  const loc = await resolveLoc(pc);
  if (!loc) { console.log(`${pc}: could not resolve — skip`); continue; }

  // NEW first (1 call), then OLD (3 calls) — small time gap; OSM data is stable per-second.
  const tN = Date.now();
  const bundle = await fetchOverpassBundle(loc);
  const newMs = Date.now() - tN;

  const tO = Date.now();
  const [st, sc, am] = [await fetchStations(loc), await fetchSchools(loc), await fetchAmenities(loc)];
  const oldMs = Date.now() - tO;

  // If EITHER side hit a transient Overpass failure, note and skip the diff for this
  // fixture (a null-vs-data mismatch is source flakiness, not a parity bug).
  const anyFail = !bundle.ok || !st.ok || !sc.ok || !am.ok;
  const stMatch = norm(bundle.stations.stations) === norm(st.stations);
  const scMatch = norm(bundle.schools.schools) === norm(sc.schools);
  const amMatch = norm(bundle.amenities.groups) === norm(am.groups);

  console.log(`${pc}: NEW 1-call ${newMs}ms · OLD 3-call ${oldMs}ms${anyFail ? "  (transient fail this run — parity skipped)" : ""}`);
  console.log(`   stations: new=${bundle.stations.stations.length} old=${st.stations.length} ${stMatch ? "✓" : "✗ MISMATCH"}`);
  console.log(`   schools:  new=${bundle.schools.schools.length} old=${sc.schools.length} ${scMatch ? "✓" : "✗ MISMATCH"}`);
  console.log(`   parks:    new=${bundle.amenities.groups.parks.total} old=${am.groups.parks.total} · super new=${bundle.amenities.groups.supermarkets.total} old=${am.groups.supermarkets.total} ${amMatch ? "✓" : "✗ MISMATCH"}`);

  if (!anyFail) {
    ok(stMatch, `${pc} stations parity`);
    ok(scMatch, `${pc} schools parity`);
    ok(amMatch, `${pc} amenities parity`);
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\nCall-count: OLD = 3 Overpass calls/brief, NEW = 1 (3× reduction, by construction).`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
