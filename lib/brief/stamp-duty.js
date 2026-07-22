/**
 * lib/brief/stamp-duty.js
 * ─────────────────────────────────────────────────────────────────────────────
 * STAMP DUTY (PRO) — pure computation, no network. Estimates the purchase tax on a
 * MAIN residence at the spine's window MEDIAN sold price, at CURRENT statutory rates.
 *
 * Two regimes, chosen by the validated country (Scotland/NI are rejected at resolve):
 *   - England & Northern Ireland → SDLT (Stamp Duty Land Tax).
 *   - Wales → LTT (Land Transaction Tax) — a DIFFERENT tax with different thresholds.
 *
 * RATES ARE VERIFIED, DATED, AND HARDCODED (they change often — re-verify on review):
 *
 *   SDLT — main residence, single property. Effective 1 April 2025 (the temporary
 *   2022–2025 nil-rate uplift ended and the £125k threshold returned).
 *   Source: https://www.gov.uk/stamp-duty-land-tax/residential-property-rates
 *     £0–£125,000            0%
 *     £125,001–£250,000      2%
 *     £250,001–£925,000      5%
 *     £925,001–£1,500,000   10%
 *     £1,500,000+           12%
 *   First-time-buyer relief: 0% to £300,000, 5% on £300,001–£500,000, no relief above
 *   £500,000. Additional-property (2nd home / BTL) surcharge: +5% on every band
 *   (raised from 3% on 31 Oct 2024).
 *
 *   LTT — main residence. Effective 10 October 2022.
 *   Source: https://www.gov.wales/land-transaction-tax-rates-and-bands
 *     £0–£225,000            0%
 *     £225,001–£400,000      6%
 *     £400,001–£750,000    7.5%
 *     £750,001–£1,500,000   10%
 *     £1,500,000+           12%
 *   LTT has no first-time-buyer relief; additional properties are taxed at higher
 *   LTT rates.
 *
 * The estimate is EXPLICITLY at the area median, NOT a buyer's actual liability
 * (which depends on the real price, whether it's their only property, and FTB status).
 * The section links to the official gov.uk / gov.wales calculator for a real figure,
 * and carries the interest-rate stress-test + leasehold guidance as clearly-labelled
 * general advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formatGBP } from "./stats.js";

/** Progressive bands as {upTo, rate}; the last band is Infinity. */
const SDLT_BANDS = [
  { upTo: 125_000, rate: 0 },
  { upTo: 250_000, rate: 0.02 },
  { upTo: 925_000, rate: 0.05 },
  { upTo: 1_500_000, rate: 0.1 },
  { upTo: Infinity, rate: 0.12 },
];

const LTT_BANDS = [
  { upTo: 225_000, rate: 0 },
  { upTo: 400_000, rate: 0.06 },
  { upTo: 750_000, rate: 0.075 },
  { upTo: 1_500_000, rate: 0.1 },
  { upTo: Infinity, rate: 0.12 },
];

const REGIMES = {
  SDLT: {
    name: "SDLT",
    longName: "Stamp Duty Land Tax",
    bands: SDLT_BANDS,
    effectiveDate: "1 April 2025",
    calculatorUrl: "https://www.tax.service.gov.uk/calculate-stamp-duty-land-tax/#/intro",
    calculatorLabel: "Estimate your exact SDLT at gov.uk",
    surchargeNote:
      "Buying an additional property (second home or buy-to-let) adds a 5% surcharge on every band.",
    ftbNote:
      "First-time buyers pay no SDLT up to £300,000, then 5% on £300,001–£500,000 (no relief on purchases above £500,000).",
  },
  LTT: {
    name: "LTT",
    longName: "Land Transaction Tax",
    bands: LTT_BANDS,
    effectiveDate: "10 October 2022",
    calculatorUrl: "https://www.gov.wales/land-transaction-tax-calculator",
    calculatorLabel: "Estimate your exact LTT at gov.wales",
    surchargeNote:
      "Wales charges LTT, not SDLT. Additional properties (second homes / buy-to-let) are taxed at higher LTT rates.",
    ftbNote: null, // LTT has no first-time-buyer relief
  },
};

/** Format a band's price window, e.g. "£125,001–£250,000" or "£1,500,000+". */
function bandLabel(from, upTo) {
  if (upTo === Infinity) return `${formatGBP(from)}+`;
  return `${formatGBP(from + (from > 0 ? 1 : 0))}–${formatGBP(upTo)}`;
}

/** Progressive tax on `price` over `bands`; returns total + per-band breakdown. */
function computeProgressive(price, bands) {
  let total = 0;
  let prev = 0;
  const breakdown = [];
  for (const band of bands) {
    const portion = Math.min(price, band.upTo) - prev;
    if (portion > 0) {
      const tax = portion * band.rate;
      total += tax;
      // Only surface bands that actually bite (rate > 0 and a taxed portion).
      if (band.rate > 0) {
        breakdown.push({
          band: bandLabel(prev, band.upTo),
          rate: `${(band.rate * 100).toFixed(band.rate * 100 % 1 === 0 ? 0 : 1)}%`,
          taxed: { raw: Math.round(tax), formatted: formatGBP(Math.round(tax)) },
        });
      }
    }
    prev = band.upTo;
    if (price <= band.upTo) break;
  }
  return { total: Math.round(total), breakdown };
}

/**
 * Build the stamp-duty PRO block from the spine window median.
 * @param {number|null} medianPrice   stats.medianPrice (window median)
 * @param {import("./resolve.js").ResolvedLocation} location
 * @returns {Object|null}  the block, or null if there's no median to price from
 */
export function buildStampDuty(medianPrice, location) {
  if (medianPrice == null || !Number.isFinite(medianPrice) || medianPrice <= 0) return null;

  const regime = location.country === "Wales" ? REGIMES.LTT : REGIMES.SDLT;
  const { total, breakdown } = computeProgressive(medianPrice, regime.bands);
  const effectiveRate = medianPrice > 0 ? total / medianPrice : 0;

  return {
    regime: regime.name,           // "SDLT" | "LTT"
    regimeLongName: regime.longName,
    atPrice: { raw: medianPrice, formatted: formatGBP(medianPrice) },
    total: { raw: total, formatted: formatGBP(total) },
    effectiveRate: `${(effectiveRate * 100).toFixed(1)}%`,
    breakdown,                     // per-band [{ band, rate, taxed }]
    effectiveDate: regime.effectiveDate,
    calculatorUrl: regime.calculatorUrl,
    calculatorLabel: regime.calculatorLabel,
    // Estimate-not-liability label + guidance (all clearly-labelled general advice).
    estimateNote:
      `Estimated ${regime.name} on a main residence at the area median sold price ` +
      `(${formatGBP(medianPrice)}) — not your liability for a specific property, which depends on the ` +
      `actual price, whether it's your only home, and first-time-buyer status.`,
    surchargeNote: regime.surchargeNote,
    ftbNote: regime.ftbNote,
    guidance: [
      "Stress-test affordability against higher interest rates: lenders check whether you could still meet repayments if rates rose, and your budget should survive the same test.",
      "If the property is leasehold, check the remaining lease term, ground rent and service charges before offering — short leases (under ~80 years) are expensive to extend and can affect mortgageability.",
    ],
  };
}
