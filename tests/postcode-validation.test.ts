/**
 * tests/postcode-validation.test.ts
 *
 * Regression tests for postcodeValidation.ts.
 * Run with:  npx tsx tests/postcode-validation.test.ts
 *
 * Tests are self-contained — no test framework required.
 * Returns exit code 0 on pass, 1 on any failure.
 *
 * This file ONLY tests the validation helper and the contract that
 * valid UK postcodes / outcodes are accepted. It does NOT call
 * generateBrief or any live API, so it cannot alter existing outputs.
 */

import { validatePostcodeInput } from "../client/src/lib/postcodeValidation";

type Case = { input: string; expectValid: boolean; label: string };

const cases: Case[] = [
  // ── Full postcodes — must be accepted ─────────────────────────────────────
  { input: "SW1A 1AA", expectValid: true,  label: "SW1A 1AA — standard full postcode with space" },
  { input: "sw1a1aa",  expectValid: true,  label: "sw1a1aa — lowercase, no space" },
  { input: "RG1 2AB",  expectValid: true,  label: "RG1 2AB — Reading full postcode" },
  { input: "LS6 2EX",  expectValid: true,  label: "LS6 2EX — Leeds full postcode" },
  { input: "EC2V7HH",  expectValid: true,  label: "EC2V7HH — City of London, no space" },
  { input: "BN1 1AA",  expectValid: true,  label: "BN1 1AA — Brighton full postcode" },
  { input: "M1 1AA",   expectValid: true,  label: "M1 1AA — Manchester short-area postcode" },
  { input: "W1A 1AA",  expectValid: true,  label: "W1A 1AA — W1A format (Central London)" },
  { input: "BS1 4DJ",  expectValid: true,  label: "BS1 4DJ — Bristol full postcode" },
  { input: "OX1 2JD",  expectValid: true,  label: "OX1 2JD — Oxford full postcode" },
  { input: "CB1 1JX",  expectValid: true,  label: "CB1 1JX — Cambridge full postcode" },
  { input: "SE15 4NX", expectValid: true,  label: "SE15 4NX — South East London (SE15)" },
  { input: "SW3 1AA",  expectValid: true,  label: "SW3 1AA — Chelsea full postcode" },

  // ── Outcodes only — must be accepted ─────────────────────────────────────
  { input: "SW3",  expectValid: true, label: "SW3 — outcode only" },
  { input: "LS6",  expectValid: true, label: "LS6 — outcode only" },
  { input: "EC2V", expectValid: true, label: "EC2V — 4-char outcode" },
  { input: "W1A",  expectValid: true, label: "W1A — 3-char outcode with letter" },
  { input: "M1",   expectValid: true, label: "M1 — 2-char outcode" },
  { input: "N1",   expectValid: true, label: "N1 — 2-char outcode (Islington)" },
  { input: "E8",   expectValid: true, label: "E8 — 2-char outcode (Hackney)" },
  { input: "B1",   expectValid: true, label: "B1 — 2-char outcode (Birmingham)" },

  // ── Address strings containing a postcode — must be accepted ─────────────
  { input: "14 High Street, SW1A 1AA", expectValid: true, label: "address with embedded postcode" },
  { input: "Chelsea SW3",              expectValid: true, label: "area name + outcode" },

  // ── Invalid inputs — must be rejected ────────────────────────────────────
  { input: "",         expectValid: false, label: "empty string" },
  { input: "   ",      expectValid: false, label: "whitespace only" },
  { input: "hello",    expectValid: false, label: "plain word, no postcode" },
  { input: "12345",    expectValid: false, label: "all digits" },
  { input: "???",      expectValid: false, label: "punctuation only" },
  { input: "SWIA1AA",  expectValid: false, label: "looks like postcode but has I instead of 1" },
  // Note: Z9Z 9ZZ passes structural validation (regex allows it) but postcodes.io
  // will return no result — the engine gracefully returns an empty-data brief.
  // We intentionally do NOT false-reject structurally plausible strings here;
  // fine-grained area-code validation is left to postcodes.io at query time.
  { input: "Z9Z 9ZZ",  expectValid: true,  label: "Z9Z 9ZZ — passes structural check, postcodes.io handles real validation" },
];

// ─── Runner ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const c of cases) {
  const result = validatePostcodeInput(c.input);
  const got = result.valid;
  if (got === c.expectValid) {
    passed++;
    console.log(`  ✓  ${c.label}`);
  } else {
    failed++;
    const detail = result.valid ? "accepted (should reject)" : `rejected: "${(result as any).reason}"`;
    const msg = `  ✗  ${c.label}\n     input="${c.input}" → ${detail}`;
    failures.push(msg);
    console.log(msg);
  }
}

console.log(`\n${passed + failed} tests | ${passed} passed | ${failed} failed\n`);

if (failed > 0) {
  console.error("REGRESSION: postcode validation tests failed.\n");
  process.exit(1);
}

console.log("All postcode validation tests passed.\n");
process.exit(0);
