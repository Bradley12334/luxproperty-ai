/**
 * lib/brief/sections/pre-offer-questions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION BUILDER — "Pre-offer Questions" (PRO).
 *
 * Questions to ask BEFORE committing, generated from THIS brief's actual findings.
 * A triggered group appears ONLY when its trigger condition is present in the
 * payload, and the trigger is shown alongside the questions so the buyer can see
 * why they're being asked (BRIEF_SPEC → questions appear only when their trigger is
 * present). A short universal due-diligence set is always shown, explicitly labelled
 * as applying to any purchase.
 *
 * Triggers, each a pure function of real payload signals:
 *   - flood band/zone elevated        → insurance, lending & Flood Re questions
 *   - softening/falling YoY           → pricing & negotiation questions
 *   - leasehold-heavy recent sales    → lease-term questions (Land Registry tenure)
 *   - recorded crime composition      → visit-timing / neighbour questions
 *   - low dataset confidence          → thin-comparable-evidence caution
 *   - new-build-heavy recent sales    → new-build premium & warranty questions
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isEntitled } from "../entitlements.js";

/** Recent standard-category sales within the last `years` calendar years. */
function recentStandardSales(txSet, endYear, years = 3) {
  if (!txSet || !Array.isArray(txSet.transactions)) return [];
  const cutoff = endYear - years + 1;
  return txSet.transactions.filter((t) => t.category === "standard" && Number(t.date.slice(0, 4)) >= cutoff);
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/**
 * @param {Object} inputs
 * @param {ReturnType<import("../stats.js").computeStats>} inputs.stats
 * @param {import("../transactions.js").TransactionSet|null} inputs.txSet
 * @param {Object|null} inputs.floodData   floodClimate section .data (riskBand/planningZone)
 * @param {Object|null} inputs.crimeData   crimeBreakdown section .data (total/categories)
 * @param {import("../resolve.js").ResolvedLocation} location
 * @param {"EXP"|"PRO"|"INV"} tier
 * @returns {Object} a BriefSection
 */
export function buildPreOfferQuestionsSection({ stats, txSet, floodData, crimeData }, location, tier) {
  const base = {
    key: "preOfferQuestions",
    title: "Pre-offer Questions",
    minTier: "PRO",
    entitled: isEntitled(tier, "section.preOfferQuestions"), // PRO; unlock-all → true
  };

  const triggered = [];

  // ── Flood: elevated band/zone → insurance & lending ─────────────────────────
  if (floodData) {
    const band = String(floodData.riskBand || "").toLowerCase();
    const zone = floodData.planningZone;
    const elevated = band.includes("high") || band.includes("medium") || zone === 2 || zone === 3;
    if (elevated) {
      const bandLabel = floodData.riskBand ? `${floodData.riskBand} river/sea risk band` : "";
      const zoneLabel = zone === 2 || zone === 3 ? `flood zone ${zone}` : "";
      const trig = [bandLabel, zoneLabel].filter(Boolean).join(" · ") || "elevated flood signal at this coordinate";
      triggered.push({
        key: "flood",
        heading: "Flood — insurance & lending",
        trigger: `This location shows ${trig}.`,
        questions: [
          "Can you obtain buildings insurance quotes for this specific address, and are premiums/excesses affected by flood risk?",
          "Is the property eligible for the Flood Re scheme (it excludes homes built after 2009), and has a previous owner ever claimed for flooding?",
          "Will my chosen lender lend against this property given the flood zone, or will it require a flood risk report first?",
          "Have there been any past flooding events, and what flood defences or drainage improvements are in place or planned?",
        ],
      });
    }
  }

  // ── Pricing: softening/falling YoY → negotiation ────────────────────────────
  const yoy = stats?.available ? stats.yoyChangePct : null;
  if (yoy != null && yoy <= -2) {
    triggered.push({
      key: "pricing",
      heading: "Pricing — a softening market",
      trigger: `The ${stats.latestYear.year} median is ${yoy.toFixed(1)}% on the year before (a softening local market).`,
      questions: [
        "How long has the property been on the market, and has the asking price been reduced since first listing?",
        "What recent comparable sales support the asking price — and how do they compare with the Land Registry medians in this brief?",
        "Is the seller under time pressure (onward chain, relocation, probate), and would they consider an offer below asking?",
        "Are there any incomplete or overpriced local listings I should weigh before anchoring to the asking price?",
      ],
    });
  }

  // ── Tenure: leasehold-heavy recent sales → lease terms ──────────────────────
  const recent = recentStandardSales(txSet, stats?.window?.endYear ?? new Date().getUTCFullYear() - 1);
  const known = recent.filter((t) => t.tenure === "Leasehold" || t.tenure === "Freehold");
  const leaseCount = known.filter((t) => t.tenure === "Leasehold").length;
  const leaseShare = pct(leaseCount, known.length);
  if (leaseShare != null && leaseShare >= 50 && known.length >= 4) {
    triggered.push({
      key: "leasehold",
      heading: "Leasehold — lease terms & charges",
      trigger: `${leaseShare}% of the last ~3 years of recorded in-district sales (${leaseCount} of ${known.length} with known tenure) were leasehold, so this is likely a leasehold property.`,
      questions: [
        "How many years remain on the lease? (Below ~80 years, extension becomes markedly more expensive and can affect mortgageability.)",
        "What are the current ground rent and service charge, how have they moved over the last five years, and are any increases built into the lease?",
        "Are any major works planned under a Section 20 notice, and what would my share be?",
        "For a flat: is there a valid EWS1 / building-safety certificate, and are there any cladding or fire-remediation issues or costs?",
        "Who manages the building, is there a residents' management company or right to manage, and are the service-charge accounts available?",
      ],
    });
  }

  // ── New-build: heavy share of recent sales → premium & warranty ─────────────
  const newBuildCount = recent.filter((t) => t.newBuild).length;
  const newBuildShare = pct(newBuildCount, recent.length);
  if (newBuildShare != null && newBuildShare >= 30 && recent.length >= 6) {
    triggered.push({
      key: "newbuild",
      heading: "New-build — premium & warranty",
      trigger: `${newBuildShare}% of recent recorded sales here were new-build, so a new-build premium may be priced in.`,
      questions: [
        "How does the price compare with nearby resale (second-hand) homes of the same size — am I paying a new-build premium?",
        "What structural warranty is in place (NHBC or equivalent), and what does it cover and for how long?",
        "Are there estate service charges or management-company fees on top of any leasehold charges?",
        "Is there any Help to Buy or shared-equity loan attached that I would need to redeem?",
      ],
    });
  }

  // ── Crime composition → visit-timing / neighbours ───────────────────────────
  if (crimeData && crimeData.total > 0 && Array.isArray(crimeData.categories)) {
    const top = crimeData.categories[0];
    const asb = crimeData.categories.find((c) => c.key === "anti-social-behaviour");
    // Only raise the timing question when the composition actually motivates it:
    // a meaningful anti-social-behaviour or public-order share is the honest trigger.
    const social = (asb?.count || 0) + (crimeData.categories.find((c) => c.key === "public-order")?.count || 0);
    if (pct(social, crimeData.total) >= 20 || (top && (top.key === "anti-social-behaviour" || top.key === "violent-crime"))) {
      triggered.push({
        key: "crime",
        heading: "Visiting — see it at different times",
        trigger: `Recorded crime nearby (${crimeData.when}) is led by ${top.label.toLowerCase()}; visit-timing is worth checking.`,
        questions: [
          "Can I view the property at more than one time — including an evening and a weekend — to gauge noise, footfall and parking?",
          "What do immediate neighbours say about the street specifically, as opposed to the wider area figures?",
          "Are there any known anti-social-behaviour issues, licensing premises, or night-time noise sources close by?",
        ],
      });
    }
  }

  // ── Thin evidence: low dataset confidence → caution ─────────────────────────
  if (stats?.available && stats.confidence?.level === "low") {
    triggered.push({
      key: "thin",
      heading: "Thin comparable evidence",
      trigger: `Only ${stats.confidence.totalCount} in-district sale${stats.confidence.totalCount === 1 ? "" : "s"} are on record for the window, so price signals here are directional.`,
      questions: [
        "Given few recent local comparables, what evidence beyond this district supports the valuation — and should I commission a RICS valuation?",
        "Would the seller accept a survey-and-valuation contingency given the thin comparable market?",
      ],
    });
  }

  // ── Universal due-diligence base set (always shown, clearly labelled) ────────
  const universal = {
    key: "universal",
    heading: "Universal due diligence (any purchase)",
    trigger: "These apply to every purchase, whatever this brief shows.",
    questions: [
      "What level of survey is appropriate (condition, homebuyer, or full structural), and what does it flag?",
      "Why is the seller moving, how long have they owned it, and is there an onward chain?",
      "What's included in the sale (fixtures, fittings, appliances, parking, outbuildings)?",
      "Are there any disputes, boundary issues, rights of way, or planning enforcement notices affecting the property?",
      "What is the EPC rating and what would it cost to improve, and what are the running costs (heating, council tax band)?",
    ],
  };

  const state = txSet || stats?.available ? "DATA" : "SPARSE";

  return {
    ...base,
    state,
    note:
      triggered.length > 0
        ? `${triggered.length} question set${triggered.length === 1 ? "" : "s"} below were triggered by this brief's own findings; the last set is universal to any purchase.`
        : "No brief-specific triggers fired for this postcode, so only the universal due-diligence questions are shown below.",
    sourceFootnote:
      "Triggered questions are generated from this brief's own signals — Environment Agency flood, HM Land Registry price trajectory and tenure/new-build mix, and data.police.uk crime composition. Each set names the finding that triggered it.",
    data: {
      triggeredCount: triggered.length,
      groups: [...triggered, universal],
    },
  };
}
