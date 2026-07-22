/**
 * lib/brief/sections/planning-activity.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Planning Activity & Risk Flags" (PRO).
 *
 * Two honest halves:
 *   1. PLANNING DESIGNATIONS at the validated coordinates (MHCLG planning.data.gov.uk,
 *      point-in-polygon) — conservation areas, Article 4 directions, listed buildings,
 *      TPO zones, Green Belt / AONB / National Park, scheduled monuments, WHS. Each
 *      named, dated, with what it means for a buyer, plus a link to the council's own
 *      planning portal for LIVE applications (there is no free national applications
 *      feed, so no count is invented — the old hashed count is gone).
 *   2. RISK FLAGS — short risk statements, each a PURE FUNCTION of a real payload
 *      signal (flood, price trajectory, dataset confidence, crime composition, and the
 *      designations above). A flag appears ONLY when its trigger fires, and the trigger
 *      is shown. No static "market flags" list.
 *
 * States:
 *   DATA         designations resolved (with or without hits) or flags present.
 *   SPARSE       district-wide (centroid) read — designations can't represent a whole district.
 *   UNAVAILABLE  the planning source couldn't be reached AND no flags fired.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";
import { councilPortal } from "../planning.js";

function yearOf(dateStr) {
  const m = /^(\d{4})/.exec(dateStr || "");
  return m ? m[1] : null;
}

/** Risk flags — each derived from a named payload signal, shown only when triggered. */
function deriveFlags({ stats, floodData, crimeData, designations }) {
  const flags = [];

  // Flood
  if (floodData) {
    const band = String(floodData.riskBand || "").toLowerCase();
    const zone = floodData.planningZone;
    if (band.includes("high") || zone === 3) {
      flags.push({ key: "flood", severity: "elevated", label: "High flood risk at this location", trigger: `Environment Agency: ${floodData.riskBand || "High"} band${zone ? ` / flood zone ${zone}` : ""}.` });
    } else if (band.includes("medium") || zone === 2) {
      flags.push({ key: "flood", severity: "watch", label: "Some flood risk to confirm", trigger: `Environment Agency: ${floodData.riskBand || "Medium"} band${zone ? ` / flood zone ${zone}` : ""}.` });
    }
  }

  // Price trajectory
  if (stats?.available && stats.yoyChangePct != null) {
    const yoy = stats.yoyChangePct;
    if (yoy <= -5) flags.push({ key: "prices", severity: "elevated", label: "Prices falling year-on-year", trigger: `${stats.latestYear.year} median ${yoy.toFixed(1)}% on the year before.` });
    else if (yoy <= -2) flags.push({ key: "prices", severity: "watch", label: "Prices softening year-on-year", trigger: `${stats.latestYear.year} median ${yoy.toFixed(1)}% on the year before.` });
  }

  // Dataset confidence
  if (stats?.available && stats.confidence?.level === "low") {
    flags.push({ key: "evidence", severity: "watch", label: "Thin sold-price evidence", trigger: `Only ${stats.confidence.totalCount} in-district sale${stats.confidence.totalCount === 1 ? "" : "s"} in the window — price reads are directional.` });
  }

  // Crime composition
  if (crimeData && crimeData.total > 0 && Array.isArray(crimeData.categories) && crimeData.categories.length) {
    const top = crimeData.categories[0];
    if (top.key === "violent-crime" && top.pct >= 25) {
      flags.push({ key: "crime", severity: "watch", label: "Violence leads the local crime mix", trigger: `${top.pct}% of recorded crime (${crimeData.when}) is ${top.label.toLowerCase()}.` });
    } else if (top.key === "anti-social-behaviour" && top.pct >= 30) {
      flags.push({ key: "crime", severity: "watch", label: "Anti-social behaviour leads the local crime mix", trigger: `${top.pct}% of recorded crime (${crimeData.when}) is anti-social behaviour.` });
    }
  }

  // Planning constraints that restrict works (from the designations we fetched)
  const restrictive = (designations || []).filter((d) =>
    ["conservation-area", "article-4-direction-area", "listed-building-outline"].includes(d.dataset),
  );
  if (restrictive.length) {
    const names = restrictive.map((d) => d.label).join(", ");
    flags.push({ key: "permitted-dev", severity: "watch", label: "Permitted-development rights likely restricted", trigger: `In scope of: ${names}. Alterations/extensions may need full consent.` });
  }
  const landscape = (designations || []).filter((d) => ["green-belt", "area-of-outstanding-natural-beauty", "national-park"].includes(d.dataset));
  if (landscape.length) {
    flags.push({ key: "landscape", severity: "info", label: "Protected-landscape constraints on development", trigger: `In: ${landscape.map((d) => d.label).join(", ")}.` });
  }

  return flags;
}

/**
 * @param {{ ok:boolean, data:{ designations:Array, lpaName:string|null }|null }} planningResult
 * @param {Object} signals  { stats, floodData, crimeData }
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildPlanningActivitySection(planningResult, signals, location, tier) {
  const base = {
    key: "planning",
    title: "Planning Activity & Risk Flags",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.planning"), // PRO; unlock-all → true
  };

  const fetched = planningResult?.ok === true && planningResult.data;
  const designations = fetched
    ? planningResult.data.designations.map((d) => ({ ...d, year: yearOf(d.date) }))
    : [];
  const lpaName = fetched ? planningResult.data.lpaName : null;
  const portal = councilPortal(location.localAuthority || lpaName || "");

  const flags = deriveFlags({ ...signals, designations });

  const portalHost = portal.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const applicationsNote =
    `Live planning-application counts aren't available from any free national feed, so none is shown here (a figure would be guesswork). ` +
    `To see current and recent applications for a specific address, search the ${location.localAuthority || lpaName || "local"} planning portal` +
    `${portal.curated ? "" : " (find yours via the Planning Portal link)"}.`;

  const grF = location.outcodeOnly
    ? `the ${location.outcode} district centroid — designations are point-specific, so a full postcode gives the picture for an exact address`
    : `the validated coordinates for ${location.postcode}`;

  // UNAVAILABLE only when the source failed AND nothing else to say.
  if (!fetched && flags.length === 0) {
    return {
      ...base,
      state: "UNAVAILABLE",
      note: `Planning designations couldn't be retrieved for ${location.postcode} right now (planning.data.gov.uk did not respond), and no risk flags were triggered by other signals. Try again shortly.`,
      sourceFootnote: "Planning designations: MHCLG Planning Data platform (planning.data.gov.uk), point-in-polygon at the coordinates.",
      data: { designations: [], flags: [], portal, lpaName, applicationsNote, designationsFetched: false },
    };
  }

  const state = location.outcodeOnly ? "SPARSE" : "DATA";
  const designationSummary =
    !fetched
      ? "Planning designations couldn't be retrieved this time; the risk flags below come from other signals."
      : designations.length === 0
        ? `No conservation-area, Article 4, listed-building, TPO or landscape designation was recorded at ${grF}. That's a genuine "no designations found" at this point, not a data gap.`
        : `${designations.length} planning designation${designations.length === 1 ? "" : "s"} recorded at ${grF}.`;

  return {
    ...base,
    state,
    note: location.outcodeOnly
      ? `${location.outcode} is a whole district — these designations are for the district centroid only. Generate a full-postcode brief for an address-specific planning read.`
      : null,
    sourceFootnote:
      `Planning designations: MHCLG Planning Data platform (planning.data.gov.uk), point-in-polygon at the coordinates${lpaName ? ` · LPA: ${lpaName}` : ""}. ` +
      `Each designation's date is its official designation/start date. Live applications are not shown — check the council portal (${portalHost}).`,
    data: {
      designationsFetched: fetched,
      designationSummary,
      designations,
      flags,
      portal,
      lpaName,
      applicationsNote,
    },
  };
}
