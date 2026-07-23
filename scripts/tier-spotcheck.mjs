/**
 * scripts/tier-spotcheck.mjs — STAGE 2c bulk validation.
 *
 * Runs 3 of the Stage-2b sample postcodes at each tier (EXP / PRO / INV) and
 * confirms the entitlement matrix holds beyond E8: LOCKED sections shrink as the
 * tier rises (EXP ⊇ PRO ⊇ INV=∅), unlocked sections all sit in a legal state, and
 * the locked SETS are nested. Districts are warm-cached from 2b, so this is fast.
 *
 *   node scripts/tier-spotcheck.mjs
 */
import { generate } from "../lib/brief/generate.js";

const POSTCODES = ["SW8 4XR", "LE1 5WP", "TR2 5HN"]; // London / E-Mids / Cornwall
const TIERS = ["EXP", "PRO", "INV"];

async function run(pc, tier) {
  const { sections } = await generate(pc, { tier });
  const locked = sections.filter((s) => s.state === "LOCKED").map((s) => s.key);
  const legal = sections.filter((s) => ["DATA", "SPARSE", "UNAVAILABLE"].includes(s.state)).length;
  const illegal = sections.filter((s) => !["DATA", "SPARSE", "UNAVAILABLE", "LOCKED"].includes(s.state)).map((s) => `${s.key}:${s.state}`);
  return { total: sections.length, unlocked: legal, lockedCount: locked.length, locked, illegal };
}

(async () => {
  console.log("STAGE 2c — tier spot-check (matrix holds beyond E8)\n");
  const results = {};
  for (const pc of POSTCODES) {
    results[pc] = {};
    for (const tier of TIERS) {
      results[pc][tier] = await run(pc, tier);
    }
  }

  console.log("postcode   tier   total  unlocked  locked  locked-section-keys");
  console.log("─────────  ─────  ─────  ────────  ──────  ───────────────────");
  let allGood = true;
  for (const pc of POSTCODES) {
    for (const tier of TIERS) {
      const r = results[pc][tier];
      console.log(`${pc.padEnd(9)}  ${tier.padEnd(5)}  ${String(r.total).padEnd(5)}  ${String(r.unlocked).padEnd(8)}  ${String(r.lockedCount).padEnd(6)}  ${r.locked.join(", ") || "—"}`);
      if (r.illegal.length) { allGood = false; console.log(`   !! ILLEGAL STATES: ${r.illegal.join(", ")}`); }
    }
    // Assertions: locked shrinks EXP ≥ PRO ≥ INV; INV = 0; nested sets
    const exp = new Set(results[pc]["EXP"].locked);
    const pro = new Set(results[pc]["PRO"].locked);
    const inv = results[pc]["INV"].locked;
    const proSubsetExp = [...pro].every((k) => exp.has(k));
    const invZero = inv.length === 0;
    const monotone = results[pc]["EXP"].lockedCount >= results[pc]["PRO"].lockedCount && results[pc]["PRO"].lockedCount >= 0;
    const ok = proSubsetExp && invZero && monotone;
    if (!ok) allGood = false;
    console.log(`   → nested(PRO⊆EXP): ${proSubsetExp} · INV fully unlocked: ${invZero} · monotone: ${monotone}  ${ok ? "✓" : "✗"}\n`);
  }
  console.log(allGood ? "✅ Matrix holds on all 3 postcodes across all tiers." : "✗ Matrix issue — see above.");
})();
