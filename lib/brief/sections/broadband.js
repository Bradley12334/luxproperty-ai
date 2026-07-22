/**
 * lib/brief/sections/broadband.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Broadband & Fibre" (PRO).
 *
 * Speeds and full-fibre availability from the consolidated Ofcom source (called via
 * lib/brief/broadband.js — the shared source is reused, never modified). LABELLED
 * WITH ITS TRUE GRANULARITY: these are local-authority-level (or regional) averages
 * from the Ofcom Connected Nations 2024 report — NOT a live per-address measurement.
 * The address-specific check is a checker.ofcom.org.uk link-out.
 *
 * States:
 *   DATA         real LA/regional figures.
 *   SPARSE       district-wide (bare outcode) brief — coverage is address/LA-specific,
 *                so we point to the checker rather than pin a figure to a district.
 *   UNAVAILABLE  the source could not resolve the postcode.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";

const CHECKER_URL = "https://checker.ofcom.org.uk/";

/**
 * @param {{ ok:boolean, data:Object|null, granularity:"local-authority"|"region"|null }} result
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildBroadbandSection(result, location, tier) {
  const base = {
    key: "broadband",
    title: "Broadband & Fibre",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.broadband"), // PRO; unlock-all → true
  };

  // District-wide: broadband is address/LA-specific, so a bare outcode can't be
  // pinned honestly — point to the checker instead of inventing a district figure.
  if (location.outcodeOnly) {
    return {
      ...base,
      state: "SPARSE",
      note:
        `This is a district-wide brief. Broadband speed and full-fibre coverage vary by street and are reported ` +
        `per local authority — enter a full postcode for the area figure, or check a specific address at checker.ofcom.org.uk.`,
      sourceFootnote: "Broadband: Ofcom Connected Nations 2024 (local-authority averages). Address-level availability: checker.ofcom.org.uk.",
      data: { checkerUrl: CHECKER_URL, granularity: null },
    };
  }

  if (!result?.ok || !result.data) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `Broadband coverage figures could not be retrieved for ${location.postcode} right now. Check your address directly at checker.ofcom.org.uk.`,
      sourceFootnote: "Broadband: Ofcom Connected Nations 2024. Address-level availability: checker.ofcom.org.uk.",
      data: { checkerUrl: CHECKER_URL, granularity: null },
    };
  }

  const d = result.data;
  const granularityLabel =
    result.granularity === "local-authority"
      ? `These are LOCAL-AUTHORITY AVERAGES for ${location.localAuthority || "this area"} from the Ofcom Connected Nations 2024 report — not a live measurement for your specific address.`
      : `These are REGIONAL AVERAGES (a specific figure for this local authority wasn't available) from the Ofcom Connected Nations 2024 report — not a live measurement for your specific address.`;

  return {
    ...base,
    state: "DATA",
    note: `${granularityLabel} Check your exact address at checker.ofcom.org.uk for the lines and speeds actually available.`,
    sourceFootnote:
      `Source: Ofcom Connected Nations 2024 (${result.granularity === "local-authority" ? "local-authority" : "regional"} averages). ` +
      `Full-fibre = FTTP-to-the-premises availability; superfast = ≥30 Mbps. Address-level availability: checker.ofcom.org.uk.`,
    data: {
      avgDownload: d.avgDownloadSpeed,       // "174 Mbps"
      avgMbps: d.avgDownloadMbps,
      fullFibre: d.fullFibreAvailability,     // "73%"
      fullFibrePct: d.fullFibrePct,
      superfast: d.sfbbAvailability,          // "98%"
      rating: d.rating,                       // Excellent / Very Good / ...
      providers: d.providers,
      granularity: result.granularity,
      checkerUrl: CHECKER_URL,
    },
  };
}
