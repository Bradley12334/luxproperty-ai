/**
 * lib/brief/sections/development-tracker.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Development Tracker" (INV).
 *
 * The old tracker was HARDCODED London schemes rendered as if nationwide — it could
 * not scale and is not shipped. There is no free national planning-application feed
 * to build a data-driven tracker from (see lib/brief/planning.js), so this section is
 * HONEST curation:
 *   - Where curation exists (lib/brief/development-schemes.js, keyed by outcode), it
 *     renders the curated major schemes, each dated and clearly labelled as editorial
 *     curation "as of <year>", NOT a live feed.
 *   - Everywhere else it says plainly that no tracked schemes are curated for the
 *     district and points to the council portal + the planning designations above.
 *
 * No invented schemes; no London content in a non-London brief (outcode-keyed).
 *
 * States:
 *   DATA    curated schemes exist for this district.
 *   SPARSE  no curation for this district — honest omission with a portal link-out.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { developmentSchemesFor } from "../development-schemes.js";
import { councilPortal } from "../planning.js";

/**
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildDevelopmentTrackerSection(location, tier) {
  const base = {
    key: "developmentTracker",
    title: "Development Tracker",
    minTier: "INV",
    entitled: isEntitled(tier, "section.developmentTracker"), // INV; unlock-all → true
  };

  const curated = developmentSchemesFor(location.outcode);
  const portal = councilPortal(location.localAuthority || "");
  const portalHost = portal.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (!curated) {
    return {
      ...base,
      state: "SPARSE",
      note:
        `No major development or regeneration schemes are curated for ${location.outcode}. This tracker is hand-curated for a ` +
        `limited set of well-documented districts — it is deliberately left empty here rather than filled with invented or ` +
        `mis-located schemes. For live applications, the local plan and any major schemes near a specific address, use the ` +
        `council's planning portal and the planning designations shown above.`,
      sourceFootnote:
        `Development Tracker is editorial curation, not a live feed. No national planning-application feed exists to populate it ` +
        `automatically. Council portal: ${portalHost}.`,
      data: { curated: false, schemes: [], asOf: null, portal },
    };
  }

  return {
    ...base,
    state: "DATA",
    note:
      `These are hand-curated major schemes known for ${location.outcode} as of ${curated.asOf} — editorial curation, not a live ` +
      `planning feed. Confirm current status on the council portal before relying on any timeline.`,
    sourceFootnote:
      `Curated major schemes for ${location.outcode}, compiled/last verified through ${curated.asOf}; not a live application feed. ` +
      `For current applications and decisions see the council portal (${portalHost}).`,
    data: {
      curated: true,
      asOf: curated.asOf,
      schemes: curated.schemes,
      portal,
    },
  };
}
