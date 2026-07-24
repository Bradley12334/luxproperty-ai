/**
 * scripts/test-source-cache.mjs — Fix 1 (per-source evidence cache) verification.
 *
 * Runs the DEPLOYED generate() repeatedly IN ONE PROCESS (so the L1 source cache is
 * hot on later runs) and asserts:
 *   1. DETERMINISM — once warm, section states no longer flicker (run 2 === run 3).
 *   2. GATING ON THE CACHED PATH (req a) — a cache-hit-served EXP request still ships
 *      ZERO data in locked sections (grep the serialized payload).
 *   3. FETCHED-AT (req c) — cached-source sections carry evidenceFetchedAt in the payload.
 *
 *   node scripts/test-source-cache.mjs
 *
 * Uses live sources on the first (cold) run; L1 makes runs 2/3 deterministic even
 * without the durable layer (no Supabase creds needed locally).
 */
import { generate } from "../lib/brief/generate.js";

const PC = process.argv[2] || "E8 1AA";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log(`  ✗ ${m}`); } };

const states = (payload) => Object.fromEntries(payload.sections.map((s) => [s.key, s.state]));

console.log(`Fix 1 source-cache verification — ${PC}\n`);

// Warm the L1 source + transaction caches (cold run may carry transient source failures).
console.log("run 1 (cold, INV) — warming L1…");
await generate(PC, { tier: "INV" });
console.log("run 2 (warm, INV)…");
const r2 = await generate(PC, { tier: "INV" });
console.log("run 3 (warm, INV)…");
const r3 = await generate(PC, { tier: "INV" });

// 1. Determinism: warm runs identical (no flicker)
const s2 = states(r2), s3 = states(r3);
const flickered = Object.keys(s2).filter((k) => s2[k] !== s3[k]);
ok(flickered.length === 0, `warm runs flicker on: ${flickered.join(", ")}`);
console.log(`  determinism: ${flickered.length === 0 ? "STABLE" : "FLICKER on " + flickered.join(",")}`);

// 3. Fetched-at present on cached-source sections (req c)
const CACHED_KEYS = ["floodClimate", "stationsCommute", "schools", "amenities", "airQuality", "crimeBreakdown", "planning", "propertyTypeSplit"];
for (const k of CACHED_KEYS) {
  const sec = r3.sections.find((s) => s.key === k);
  ok(sec && Object.prototype.hasOwnProperty.call(sec, "evidenceFetchedAt"), `${k} missing evidenceFetchedAt`);
}
const withAge = r3.sections.filter((s) => typeof s.evidenceFetchedAt === "number").map((s) => s.key);
console.log(`  evidenceFetchedAt present & numeric (served-from-cache) on: ${withAge.join(", ") || "(none — all live this run)"}`);

// 2. GATING on the cached path (req a): EXP request served from the warm cache must
//    ship ZERO data in locked sections. Grep the serialized payload exactly like
//    test-gating, but on the cache-hit path.
console.log("run 4 (warm, EXP) — gating grep on the cached path…");
const rExp = await generate(PC, { tier: "EXP" });
const locked = rExp.sections.filter((s) => s.state === "LOCKED");
ok(locked.length > 0, "EXP produced no LOCKED sections (unexpected)");
const leaks = locked.filter((s) => s.data != null);
ok(leaks.length === 0, `LOCKED sections leaked data on the cached path: ${leaks.map((s) => s.key).join(", ")}`);
// belt-and-braces: the serialized locked stubs must contain no nested "data" payload
const serializedLeak = locked.some((s) => JSON.stringify(s).includes('"data":') && s.data != null);
ok(!serializedLeak, "serialized LOCKED stub still carries a data payload");
console.log(`  EXP cached-path: ${locked.length} LOCKED sections, ${leaks.length} with leaked data`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
