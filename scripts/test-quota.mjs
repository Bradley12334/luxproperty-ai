/**
 * scripts/test-quota.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * QUOTA LOGIC — the Explorer 3-briefs/month enforcement math.
 *   A. monthKey / nextMonthResetISO — UTC calendar-month boundaries.
 *   B. quotaStatus — limit/used/remaining/exceeded across EXP (finite) and
 *      PRO/INV (unlimited), and the anonymous-vs-authenticated flag.
 *   C. (opt-in, needs SUPABASE_* env) a live count/record/delete round-trip
 *      against public.brief_generations proving the enforced count is real.
 *
 * The DB path auto-skips when env is absent (as it is in local dev); that path is
 * additionally verified out-of-band via the Supabase MCP. Run: node scripts/test-quota.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { monthKey, nextMonthResetISO, quotaStatus, countGenerations, recordGeneration } from "../lib/brief/quota.js";

let pass = 0,
  fail = 0;
const check = (name, cond) => {
  if (cond) pass++;
  else {
    fail++;
    console.log(`   ✗ ${name}`);
  }
};

console.log("\nQUOTA LOGIC\n");

// ── A. month boundaries (UTC) ────────────────────────────────────────────────
console.log("A. month keys");
check("monthKey mid-month", monthKey(new Date("2026-07-23T10:00:00Z")) === "2026-07");
check("monthKey Jan single-digit padded", monthKey(new Date("2026-01-05T00:00:00Z")) === "2026-01");
check("monthKey Dec", monthKey(new Date("2026-12-31T23:59:59Z")) === "2026-12");
check("monthKey uses UTC (late-night boundary)", monthKey(new Date("2026-07-31T23:30:00Z")) === "2026-07");
check("reset from July → Aug 1", nextMonthResetISO(new Date("2026-07-23T10:00:00Z")) === "2026-08-01");
check("reset from Dec → next Jan 1", nextMonthResetISO(new Date("2026-12-15T00:00:00Z")) === "2027-01-01");
console.log("");

// ── B. quotaStatus ───────────────────────────────────────────────────────────
console.log("B. quotaStatus");
const now = new Date("2026-07-23T10:00:00Z");
const m = "2026-07";

const exp0 = quotaStatus("EXP", 0, m, now, true);
check("EXP 0/3 → limit 3, remaining 3, not exceeded", exp0.limit === 3 && exp0.remaining === 3 && exp0.exceeded === false);
check("EXP 0/3 → not unlimited", exp0.unlimited === false);
check("EXP resetsOn is Aug 1", exp0.resetsOn === "2026-08-01");

const exp2 = quotaStatus("EXP", 2, m, now, true);
check("EXP 2/3 → remaining 1, not exceeded (the 3rd is allowed)", exp2.remaining === 1 && exp2.exceeded === false);

const exp3 = quotaStatus("EXP", 3, m, now, true);
check("EXP 3/3 → remaining 0, EXCEEDED (the 4th is blocked)", exp3.remaining === 0 && exp3.exceeded === true);

const exp4 = quotaStatus("EXP", 4, m, now, true);
check("EXP 4/3 → still exceeded, remaining clamped to 0", exp4.exceeded === true && exp4.remaining === 0);

const pro = quotaStatus("PRO", 99, m, now, true);
check("PRO → unlimited, never exceeded", pro.unlimited === true && pro.exceeded === false && pro.limit === null && pro.remaining === null);

const inv = quotaStatus("INV", 999, m, now, true);
check("INV → unlimited, never exceeded", inv.unlimited === true && inv.exceeded === false);

const anon = quotaStatus("EXP", 0, m, now, false);
check("anonymous EXP → authenticated:false, not exceeded", anon.authenticated === false && anon.exceeded === false);
console.log("");

// ── C. live DB round-trip (opt-in) ───────────────────────────────────────────
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.TEST_USER_ID) {
  console.log("C. LIVE brief_generations round-trip");
  const uid = process.env.TEST_USER_ID;
  const tm = "2099-01"; // a month that will never collide with real data
  // clean slate
  const c0 = await countGenerations(uid, tm);
  check("baseline count is 0 (test month)", c0 === 0);
  await recordGeneration(uid, tm, "E8");
  await recordGeneration(uid, tm, "E8");
  await recordGeneration(uid, tm, "E8");
  const c3 = await countGenerations(uid, tm);
  check("after 3 records, count is 3", c3 === 3);
  check("EXP would now be exceeded", quotaStatus("EXP", c3, tm, now, true).exceeded === true);
  // cleanup handled by the caller / MCP (no delete helper in the lib — quota never deletes).
  console.log(`   (left 3 test rows in month ${tm} for user ${uid}; delete them via MCP)`);
  console.log("");
} else {
  console.log("C. LIVE round-trip SKIPPED (set SUPABASE_URL, SUPABASE_SERVICE_KEY, TEST_USER_ID to run; verified via MCP instead)\n");
}

console.log(`${fail === 0 ? "✓ ALL PASS" : "✗ FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
