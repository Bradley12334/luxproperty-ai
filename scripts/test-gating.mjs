/**
 * scripts/test-gating.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * TIER-GATE VERIFICATION — proves the server-side gate (lib/brief/gate.js):
 *   A. Locks every section above the caller's tier, DROPPING its data (data:null).
 *   B. Leaves entitled sections intact.
 *   C. Trims the price-trend depth to the entitled window (EXP 1 / PRO 5 / INV 10)
 *      and locks the PRO negotiation sub-block below PRO.
 *   D. THE PAYLOAD-GREP GATE: the serialized JSON of a lower-tier payload contains
 *      ZERO data sentinels from higher-tier sections. This is the spec's
 *      non-negotiable — locked content is never in the response, not merely hidden.
 *   E. (best-effort, network) a live generate() for E8 1NG at EXP vs PRO vs INV,
 *      asserting the same invariants on real section data.
 *
 * Run: node scripts/test-gating.mjs   (add --live for section E)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { gateSections, SECTION_ENTITLEMENT } from "../lib/brief/gate.js";
import { ENTITLEMENTS, TIER_RANK, isEntitled } from "../lib/brief/entitlements.js";
import { outcodeOf } from "../lib/brief/ownership.js";

let pass = 0,
  fail = 0;
const check = (name, cond) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`   ✗ ${name}`);
  }
};

// ── Section catalogue: key → minTier, straight from the entitlement config. ──────
const SECTION_MIN_TIER = {};
for (const [key, entKey] of Object.entries(SECTION_ENTITLEMENT)) {
  SECTION_MIN_TIER[key] = ENTITLEMENTS[entKey].minTier;
}

// Unique data sentinel per section — if this string survives serialization at a tier
// below the section's minTier, the gate leaked locked content.
const sentinel = (key) => `__SENTINEL_DATA_${key}__`;

/** Build a synthetic FULL payload (every section state:DATA with a sentinel). */
function buildFullSections() {
  return Object.keys(SECTION_ENTITLEMENT).map((key) => {
    if (key === "pricesTrendNegotiation") {
      // Composite: EXP market overview + depth-tiered 10yr trend + PRO negotiation.
      const rows = [];
      for (let y = 2015; y <= 2024; y++) {
        rows.push({ year: y, count: 20, median: { raw: 500000, formatted: "£500,000" }, change: { raw: 1, formatted: "+1.0%" }, state: "data" });
      }
      return {
        key,
        title: "Prices, Trend & Negotiation",
        minTier: "EXP",
        state: "DATA",
        data: {
          marketOverview: { marker: sentinel("marketOverview"), windowMedian: { formatted: "£500,000" } },
          trend: { years: 10, rows, hasSparseYears: false, lowVolumeNote: null },
          negotiation: {
            entitled: true,
            fairValueRange: { marker: sentinel("negotiation"), anchor: { formatted: "£500,000" } },
            openingRange: { low: { formatted: "£460,000" } },
            leveragePoints: [{ signal: "x", text: "lever" }],
            notAValuationNote: "Not a formal valuation.",
          },
        },
      };
    }
    return {
      key,
      title: `Section ${key}`,
      minTier: SECTION_MIN_TIER[key],
      state: "DATA",
      data: { marker: sentinel(key), value: 42 },
    };
  });
}

console.log("\nTIER-GATE VERIFICATION\n");

// ── A/B/C: per-tier structural assertions ───────────────────────────────────────
for (const tier of ["EXP", "PRO", "INV"]) {
  console.log(`A/B/C. tier = ${tier}`);
  const gated = gateSections(buildFullSections(), tier);
  const byKey = Object.fromEntries(gated.map((s) => [s.key, s]));

  for (const [key, minTier] of Object.entries(SECTION_MIN_TIER)) {
    const s = byKey[key];
    const entitled = TIER_RANK[tier] >= TIER_RANK[minTier];
    if (key === "pricesTrendNegotiation") continue; // handled below
    if (entitled) {
      check(`${key}: entitled → state stays DATA`, s.state === "DATA");
      check(`${key}: entitled → data present`, s.data && s.data.marker === sentinel(key));
    } else {
      check(`${key}: locked → state LOCKED`, s.state === "LOCKED");
      check(`${key}: locked → data dropped (null)`, s.data === null);
      check(`${key}: locked → has upgrade CTA target`, s.cta && s.cta.target === "/pricing");
      check(`${key}: locked → requiredTier is its minTier`, s.requiredTier === minTier);
      check(`${key}: locked → has a description`, typeof s.description === "string" && s.description.length > 0);
    }
  }

  // Composite prices section: EXP floor always present; depth + negotiation vary.
  const prices = byKey.pricesTrendNegotiation;
  check(`prices: present (EXP floor)`, prices.state === "DATA");
  check(`prices: market overview retained`, prices.data.marketOverview.marker === sentinel("marketOverview"));
  const expectDepth = tier === "INV" ? 10 : tier === "PRO" ? 5 : 1;
  check(`prices: trend trimmed to ${expectDepth}yr`, prices.data.trend.rows.length === expectDepth);
  check(`prices: trend keeps the MOST RECENT year (2024)`, prices.data.trend.rows.at(-1).year === 2024);
  if (tier === "EXP") {
    check(`prices: EXP trend is exactly the latest year`, prices.data.trend.rows[0].year === 2024);
    check(`prices: EXP negotiation locked`, prices.data.negotiation.locked === true);
    check(`prices: EXP negotiation figures dropped`, prices.data.negotiation.fairValueRange === null && prices.data.negotiation.openingRange == null && prices.data.negotiation.leveragePoints.length === 0);
    check(`prices: EXP negotiation keeps not-a-valuation note`, /not a formal valuation/i.test(prices.data.negotiation.notAValuationNote));
  } else {
    check(`prices: ${tier} negotiation present`, prices.data.negotiation.fairValueRange && prices.data.negotiation.fairValueRange.marker === sentinel("negotiation"));
  }
  console.log("");
}

// ── D: THE PAYLOAD-GREP GATE ─────────────────────────────────────────────────────
console.log("D. payload-grep — zero higher-tier data sentinels in a lower-tier payload");
for (const tier of ["EXP", "PRO"]) {
  const gated = gateSections(buildFullSections(), tier);
  const json = JSON.stringify(gated);
  for (const [key, minTier] of Object.entries(SECTION_MIN_TIER)) {
    if (TIER_RANK[tier] >= TIER_RANK[minTier]) continue; // entitled — sentinel allowed
    check(`${tier}: no "${key}" data sentinel in serialized payload`, !json.includes(sentinel(key)));
  }
  // The PRO negotiation sentinel must be absent from an EXP payload.
  if (tier === "EXP") {
    check(`EXP: no negotiation sentinel in serialized payload`, !JSON.stringify(gated).includes(sentinel("negotiation")));
  }
  // Sanity: an entitled sentinel IS present (proves the grep would have caught a leak).
  const execPresent = JSON.stringify(gated).includes(sentinel("executiveSummary"));
  check(`${tier}: entitled sentinel (executiveSummary) IS present — grep is meaningful`, execPresent);
}
console.log("");

// ── F: FULL BRIEF OWNERSHIP — owned outcode → INV depth; other districts still gate ──
// Mirrors the api/brief.js decision (effectiveTier = owned ? "INV" : accountTier) and
// re-runs the payload-grep with ownership ON vs OFF. Proves the spec invariant: a Full
// Brief owner gets full data for OWNED outcodes only; a non-owned postcode from the SAME
// account still gates by plan.
console.log("F. Full Brief ownership — owned outcode → INV data; non-owned → plan tier");
{
  // F0: the ownership key derivation agrees with resolve()/meta.outcode (drives the match).
  check(`outcodeOf("e8 1ng") = E8`, outcodeOf("e8 1ng") === "E8");
  check(`outcodeOf("sw1a 1aa") = SW1A`, outcodeOf("sw1a 1aa") === "SW1A");
  check(`outcodeOf("ec1a 1bb") = EC1A`, outcodeOf("ec1a 1bb") === "EC1A");
  check(`outcodeOf bare "E8" = E8`, outcodeOf("E8") === "E8");
  check(`outcodeOf("") = ""`, outcodeOf("") === "");

  const effectiveTier = (accountTier, owned) => (owned ? "INV" : accountTier);

  // F1: an EXP-plan account OWNING this district sees full INV data — nothing locked.
  const ownedView = gateSections(buildFullSections(), effectiveTier("EXP", true));
  const ownedJson = JSON.stringify(ownedView);
  check(`owned district: zero sections locked`, !ownedView.some((s) => s.state === "LOCKED"));
  for (const key of Object.keys(SECTION_MIN_TIER)) {
    if (key === "pricesTrendNegotiation") continue;
    check(`owned district: ${key} data present (incl. PRO/INV)`, ownedJson.includes(sentinel(key)));
  }
  check(`owned district: full 10yr trend depth`,
    ownedView.find((s) => s.key === "pricesTrendNegotiation").data.trend.rows.length === 10);

  // F2: the SAME EXP-plan account viewing a NON-owned district still gates by plan —
  // zero PRO/INV data sentinels survive (the payload-grep invariant, ownership OFF).
  const otherView = gateSections(buildFullSections(), effectiveTier("EXP", false));
  const otherJson = JSON.stringify(otherView);
  for (const [key, minTier] of Object.entries(SECTION_MIN_TIER)) {
    if (TIER_RANK["EXP"] >= TIER_RANK[minTier]) continue; // EXP-entitled sentinel allowed
    check(`non-owned district: no "${key}" sentinel (still gated)`, !otherJson.includes(sentinel(key)));
  }

  // F3: ownership genuinely flips the outcome for a gated INV section — present when
  // owned, absent when not. (Proves F1/F2 aren't both trivially true.)
  check(`ownership flips a gated INV section (soldPricesMap)`,
    ownedJson.includes(sentinel("soldPricesMap")) && !otherJson.includes(sentinel("soldPricesMap")));
}
console.log("");

// ── E: live cross-check (opt-in) ────────────────────────────────────────────────
if (process.argv.includes("--live")) {
  console.log("E. LIVE — generate() E8 1NG at EXP / PRO / INV (network; ~20–30s each)\n");
  const { generate } = await import("../lib/brief/generate.js");
  const LOCKED_AT = { EXP: ["nearbySoldPrices", "crimeBreakdown", "planning", "streetPriceRanking", "soldPricesMap", "developmentTracker", "rentalDemandScore"], PRO: ["streetPriceRanking", "soldPricesMap", "developmentTracker", "rentalDemandScore"], INV: [] };
  for (const tier of ["EXP", "PRO", "INV"]) {
    try {
      const out = await generate("E8 1NG", { tier });
      const byKey = Object.fromEntries(out.sections.map((s) => [s.key, s]));
      check(`${tier}: meta.tier echoes ${tier}`, out.meta.tier === tier);
      for (const k of LOCKED_AT[tier]) {
        check(`${tier}: ${k} LOCKED with null data`, byKey[k]?.state === "LOCKED" && byKey[k]?.data === null);
      }
      // The verdict (EXP) must always be a real DATA/refusal card, never locked.
      check(`${tier}: verdict present and not LOCKED`, byKey.areaVerdict && byKey.areaVerdict.state !== "LOCKED");
      // Depth: entitled trend length ≤ expected window.
      const expectDepth = tier === "INV" ? 10 : tier === "PRO" ? 5 : 1;
      const trendRows = byKey.pricesTrendNegotiation?.data?.trend?.rows?.length;
      if (typeof trendRows === "number") check(`${tier}: live trend ≤ ${expectDepth} rows`, trendRows <= expectDepth);
      console.log(`   ${tier}: ${out.sections.filter((s) => s.state === "LOCKED").length} sections locked, verdict=${byKey.areaVerdict?.data?.verdict ?? byKey.areaVerdict?.state}`);
    } catch (err) {
      check(`${tier}: generate() completed`, false);
      console.log(`   ${tier}: generate threw — ${err?.message || err}`);
    }
  }
  console.log("");
}

console.log(`\n${fail === 0 ? "✓ ALL PASS" : "✗ FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
