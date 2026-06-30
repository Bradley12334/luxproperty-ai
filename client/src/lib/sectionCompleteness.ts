/**
 * sectionCompleteness.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data completeness framework for the valuation result page.
 *
 * Every section on the page is scored against a four-state scale:
 *   complete   — most meaningful fields present, render full section
 *   partial    — some fields present, render confirmed fields only + note
 *   sparse     — too little data for a full card, collapse to compact status card
 *   unavailable — nothing useful; hide entirely or inline one-line note
 *
 * Rules:
 *  - No section renders blank/placeholder rows
 *  - Missing fields are filtered out, not labelled "Not on record"
 *  - Multiple missing fields collapse to one grouped note
 *  - Never imply absence of data is a meaningful signal
 *  - Never show more than one sparse/unavailable section consecutively
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  PropertyFacts,
  OwnershipCosts,
  LeaseholdSummary,
  ValueDrivers,
  ValuationReport,
  EpcData,
  PlanningApplication,
  RentalContext,
} from "./valuationEngine";
import type { ModuleMetadata } from "./valuationSources";

// ─── Completeness state ────────────────────────────────────────────────────────

export type CompletenessState = "complete" | "partial" | "sparse" | "unavailable";

export interface CompletenessResult {
  state:          CompletenessState;
  confirmedCount: number;
  totalCount:     number;
  /** Short human-readable description of what is confirmed */
  confirmedNote:  string | null;
  /** Reason copy shown in sparse/unavailable state */
  sparseMessage:  string | null;
  /** Provenance label for the section header */
  provenanceLabel: ProvenanceLabel;
}

// ─── Provenance labels ────────────────────────────────────────────────────────

export type ProvenanceLabel =
  | "Confirmed from Land Registry"
  | "EPC register match found"
  | "Derived from postcode benchmarks"
  | "Source coverage incomplete"
  | "Seller confirmation needed"
  | "Confirmed from official data"
  | null;

// ─── Field row type (used by filterEmptyFields) ───────────────────────────────

export interface FieldRow {
  label:   string;
  value:   string | null;
  note?:   string;
  caveat?: string;
  /** How confident/confirmed is this field? */
  provenance?: "confirmed" | "inferred" | "benchmark" | "unavailable";
}

// ─── Filter empty fields ──────────────────────────────────────────────────────

/**
 * Strip null/empty rows from a field list.
 * Returns only rows with a real value plus a count of how many were stripped.
 */
export function filterEmptyFields(rows: FieldRow[]): {
  populated: FieldRow[];
  missingCount: number;
  missingLabels: string[];
} {
  const populated = rows.filter((r) => r.value !== null && r.value !== "");
  const missing   = rows.filter((r) => r.value === null || r.value === "");
  return {
    populated,
    missingCount:  missing.length,
    missingLabels: missing.map((r) => r.label),
  };
}

// ─── Property facts completeness ──────────────────────────────────────────────

export function getPropertyFactsCompleteness(f: PropertyFacts): CompletenessResult {
  const fields: FieldRow[] = [
    { label: "Property type",   value: f.propertyType,   provenance: "confirmed" },
    { label: "Tenure",          value: f.tenure,          provenance: "confirmed" },
    { label: "Floor area",      value: f.floorAreaM2 ? `${f.floorAreaM2} m²` : null, provenance: "confirmed" },
    { label: "EPC band",        value: f.epcBand,         provenance: "confirmed" },
    { label: "Est. bedrooms",   value: f.bedroomsEst,     provenance: "inferred",
      caveat: f.bedroomsEst ? "Estimated from floor area" : undefined },
    { label: "Council tax band",value: f.councilTaxBand,  provenance: "confirmed" },
    { label: "Construction era",value: f.yearBuiltBand,   provenance: "inferred" },
  ];

  const { populated, missingCount } = filterEmptyFields(fields);
  const confirmedCount = populated.length;
  const totalCount     = fields.length;

  // Threshold rules:
  //  ≥4 confirmed  → complete
  //  2–3 confirmed → partial
  //  <2 confirmed  → sparse (show verification prompt only)
  //  0 confirmed   → unavailable (hide)

  if (confirmedCount === 0) {
    return {
      state: "unavailable",
      confirmedCount, totalCount,
      confirmedNote:   null,
      sparseMessage:   null,
      provenanceLabel: null,
    };
  }

  if (confirmedCount < 2) {
    return {
      state: "sparse",
      confirmedCount, totalCount,
      confirmedNote:   null,
      sparseMessage:   "Limited property details are available from current public records for this postcode. Verify directly with the seller or your solicitor.",
      provenanceLabel: "Source coverage incomplete",
    };
  }

  if (confirmedCount < 4) {
    return {
      state: "partial",
      confirmedCount, totalCount,
      confirmedNote:   `${confirmedCount} of ${totalCount} details confirmed from public records`,
      sparseMessage:   missingCount > 0
        ? `${missingCount} field${missingCount > 1 ? "s" : ""} not found in current public records`
        : null,
      provenanceLabel: confirmedCount >= 2 ? "Confirmed from Land Registry" : "Source coverage incomplete",
    };
  }

  return {
    state: "complete",
    confirmedCount, totalCount,
    confirmedNote:   confirmedCount < totalCount
      ? `${confirmedCount} of ${totalCount} details confirmed from public records`
      : null,
    sparseMessage:   null,
    provenanceLabel: "Confirmed from Land Registry",
  };
}

// ─── Ownership costs completeness ─────────────────────────────────────────────

export function getOwnershipCostsCompleteness(
  oc: OwnershipCosts,
  isLeasehold: boolean,
): CompletenessResult {
  // SDLT is always present (calculated from estimate) — it counts as confirmed
  const sdltPresent  = oc.sdltMid !== null;
  const ctPresent    = oc.councilTaxBand !== null;
  const epcPresent   = oc.epcBand !== null || oc.energyEfficiencyNote !== null;

  // Leasehold costs only count for leasehold properties
  const lhServicePresent = isLeasehold && oc.serviceChargeNote !== null;
  const lhGroundPresent  = isLeasehold && oc.groundRentNote !== null;

  const confirmedCount = [sdltPresent, ctPresent, epcPresent].filter(Boolean).length
    + (isLeasehold ? [lhServicePresent, lhGroundPresent].filter(Boolean).length : 0);

  // Thresholds:
  //  ≥3 confirmed → complete
  //  2 confirmed  → partial (show what we have)
  //  1 confirmed  → sparse (stamp duty only card)
  //  0 confirmed  → hide

  if (confirmedCount === 0) {
    return {
      state: "unavailable",
      confirmedCount, totalCount: 3,
      confirmedNote:   null,
      sparseMessage:   null,
      provenanceLabel: null,
    };
  }

  if (confirmedCount === 1 && sdltPresent && !ctPresent) {
    // Only SDLT — not enough to justify a full costs section
    return {
      state: "sparse",
      confirmedCount, totalCount: 3,
      confirmedNote:   null,
      sparseMessage:   "Stamp duty is calculated from the valuation estimate. Council tax band and energy data are not available from current records for this postcode.",
      provenanceLabel: "Derived from postcode benchmarks",
    };
  }

  if (confirmedCount < 3) {
    return {
      state: "partial",
      confirmedCount, totalCount: isLeasehold ? 5 : 3,
      confirmedNote:   `${confirmedCount} cost items confirmed from public records`,
      sparseMessage:   "Some cost fields are not available from current public records — request from your solicitor or the seller.",
      provenanceLabel: ctPresent ? "Confirmed from official data" : "Derived from postcode benchmarks",
    };
  }

  return {
    state: "complete",
    confirmedCount, totalCount: isLeasehold ? 5 : 3,
    confirmedNote:   null,
    sparseMessage:   null,
    provenanceLabel: ctPresent ? "Confirmed from official data" : "Derived from postcode benchmarks",
  };
}

// ─── EPC completeness ─────────────────────────────────────────────────────────

export function getEpcCompleteness(
  epc: EpcData | null,
  meta: ModuleMetadata,
): CompletenessResult {
  if (meta.freshnessStatus === "unavailable" || !epc) {
    return {
      state: "sparse",   // sparse not unavailable — EPC matters for trust
      confirmedCount: 0, totalCount: 1,
      confirmedNote:   null,
      sparseMessage:   "No EPC record was returned for this postcode from the official register. This may mean the property predates mandatory EPC requirements, or no assessment has been lodged. Check the official EPC register before relying on energy assumptions.",
      provenanceLabel: "Source coverage incomplete",
    };
  }

  return {
    state: "complete",
    confirmedCount: 1, totalCount: 1,
    confirmedNote:   null,
    sparseMessage:   epc.isExpired
      ? "This certificate has expired — current energy performance may differ."
      : null,
    provenanceLabel: "EPC register match found",
  };
}

// ─── Planning completeness ────────────────────────────────────────────────────

/**
 * Planning is special: absence of results does NOT mean "no activity".
 * Coverage of the planning data source is incomplete for many LPAs.
 * We must never present absence as a confirmed signal.
 */
export function getPlanningCompleteness(
  applications: PlanningApplication[],
  meta: ModuleMetadata,
): CompletenessResult {
  if (meta.freshnessStatus === "unavailable") {
    return {
      state: "sparse",
      confirmedCount: 0, totalCount: 0,
      confirmedNote:   null,
      sparseMessage:   "Planning data could not be retrieved for this area. This may be a temporary service issue. Check the local planning authority's portal directly for recent applications.",
      provenanceLabel: "Source coverage incomplete",
    };
  }

  if (applications.length === 0) {
    // Do NOT say "no applications found" — coverage is partial
    return {
      state: "sparse",
      confirmedCount: 0, totalCount: 0,
      confirmedNote:   null,
      sparseMessage:   "Planning coverage is incomplete for this area — we cannot draw a conclusion from the current results. Local planning portals may hold additional applications not yet in this dataset.",
      provenanceLabel: "Source coverage incomplete",
    };
  }

  return {
    state: "complete",
    confirmedCount: applications.length, totalCount: applications.length,
    confirmedNote:   null,
    sparseMessage:   null,
    provenanceLabel: "Confirmed from official data",
  };
}

// ─── Leasehold completeness ───────────────────────────────────────────────────

export function getLeaseholdCompleteness(l: LeaseholdSummary): CompletenessResult {
  // Only called when isLeasehold is true
  const hasYears   = l.leaseYearsRemaining !== null;
  const hasService = l.serviceChargeNote !== null;
  const hasGround  = l.groundRentNote !== null;

  const confirmedCount = [hasYears].filter(Boolean).length;
  // Service charge and ground rent are almost never in public records —
  // treat them as "seller confirmation" rather than "missing"

  if (!hasYears) {
    return {
      state: "partial",
      confirmedCount: 0, totalCount: 1,
      confirmedNote:   null,
      sparseMessage:   "Lease terms are not available from Land Registry or EPC records for this property. Request the full lease from the seller or their solicitor before making an offer.",
      provenanceLabel: "Seller confirmation needed",
    };
  }

  return {
    state: "complete",
    confirmedCount: 1, totalCount: 1,
    confirmedNote:   (!hasService || !hasGround)
      ? "Service charge and ground rent are not held in public records — request from seller"
      : null,
    sparseMessage:   null,
    provenanceLabel: "Confirmed from Land Registry",
  };
}

// ─── Value drivers completeness ───────────────────────────────────────────────

export function getValueDriversCompleteness(vd: ValueDrivers): CompletenessResult {
  const total = vd.increases.length + vd.decreases.length;

  if (total === 0) {
    return {
      state: "unavailable",
      confirmedCount: 0, totalCount: 0,
      confirmedNote:   null,
      sparseMessage:   null,
      provenanceLabel: null,
    };
  }

  if (total <= 2) {
    return {
      state: "partial",
      confirmedCount: total, totalCount: total,
      confirmedNote:   "Limited signals available from current public data",
      sparseMessage:   null,
      provenanceLabel: "Derived from postcode benchmarks",
    };
  }

  return {
    state: "complete",
    confirmedCount: total, totalCount: total,
    confirmedNote:   null,
    sparseMessage:   null,
    provenanceLabel: "Confirmed from official data",
  };
}

// ─── Consecutive sparse/unavailable gate ──────────────────────────────────────

/**
 * Given an ordered list of section completeness results, returns a set of
 * section keys that should be suppressed because they follow another
 * sparse/unavailable section consecutively.
 *
 * Rule: never show more than one sparse section in a row.
 * The weaker of two consecutive sparse sections is suppressed.
 * "Weaker" = lower confirmedCount; ties go to the later section.
 */
export function getConsecutiveSuppressedSections(
  sections: { key: string; result: CompletenessResult }[],
): Set<string> {
  const suppressed = new Set<string>();
  let lastSparseKey: string | null = null;
  let lastSparseCount = 0;

  for (const { key, result } of sections) {
    const isSparse = result.state === "sparse" || result.state === "unavailable";

    if (isSparse && lastSparseKey !== null) {
      // Two consecutive sparse/unavailable — suppress the weaker one
      if (result.confirmedCount <= lastSparseCount) {
        suppressed.add(key);
        // lastSparse stays as the previous (stronger) one
      } else {
        suppressed.add(lastSparseKey);
        lastSparseKey   = key;
        lastSparseCount = result.confirmedCount;
      }
    } else if (isSparse) {
      lastSparseKey   = key;
      lastSparseCount = result.confirmedCount;
    } else {
      lastSparseKey = null;
    }
  }

  return suppressed;
}

// ─── Provenance label chip ────────────────────────────────────────────────────

/** Map provenance label → colour class for the chip */
export function getProvenanceChipClass(label: ProvenanceLabel): string {
  switch (label) {
    case "Confirmed from Land Registry":
    case "EPC register match found":
    case "Confirmed from official data":
      return "border-green-500/30 text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-950/20";
    case "Derived from postcode benchmarks":
      return "border-amber-400/40 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20";
    case "Source coverage incomplete":
      return "border-border text-muted-foreground bg-muted/40";
    case "Seller confirmation needed":
      return "border-amber-400/40 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20";
    default:
      return "border-border text-muted-foreground bg-muted/40";
  }
}

// ─── Module state types ───────────────────────────────────────────────────────

/**
 * Four-state rendering decision for each module.
 *  full    — render the complete card
 *  compact — render a condensed card (key facts only)
 *  warning — render a small warning/advisory panel, no data table
 *  hidden  — do not render the section at all
 */
export type ModuleRenderState = "full" | "compact" | "warning" | "hidden";

export interface ModuleDecision {
  state:        ModuleRenderState;
  /** Short copy shown in compact/warning state */
  copy:         string | null;
  /** Optional CTA text for compact/warning cards */
  ctaText:      string | null;
  ctaUrl:       string | null;
  provenanceLabel: ProvenanceLabel;
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

/** Count how many values in an object are non-null, non-empty-string */
export function getFieldAvailabilityCount(
  fields: Record<string, unknown>,
): number {
  return Object.values(fields).filter((v) => v !== null && v !== undefined && v !== "").length;
}

/** Filter unknown (null/empty) rows from a generic key-value map, returning only populated ones */
export function filterUnknownFields<T extends Record<string, unknown>>(
  fields: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== null && v !== undefined && v !== "") {
      (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}

/**
 * Core module-state decider.
 * Pass counts of confirmed / inferred / benchmark / missing fields.
 * Returns a ModuleRenderState based on the thresholds provided.
 */
export function getModuleState(opts: {
  confirmed:  number;
  inferred:   number;
  benchmark:  number;
  missing:    number;
  /** Minimum confirmed fields to reach "full" */
  fullThreshold?: number;
  /** Minimum total (confirmed + inferred) to reach "compact" */
  compactThreshold?: number;
}): ModuleRenderState {
  const { confirmed, inferred, benchmark, missing } = opts;
  const fullThreshold    = opts.fullThreshold    ?? 3;
  const compactThreshold = opts.compactThreshold ?? 1;
  const total = confirmed + inferred + benchmark;

  if (confirmed >= fullThreshold)                 return "full";
  if (confirmed + inferred >= compactThreshold)   return "compact";
  if (benchmark > 0 && missing > benchmark)       return "warning";
  if (total > 0)                                  return "compact";
  return "hidden";
}

export function shouldRenderFullModule(state: ModuleRenderState): boolean {
  return state === "full";
}

export function shouldRenderCompactModule(state: ModuleRenderState): boolean {
  return state === "full" || state === "compact";
}

// ─── Rental yield context decision ───────────────────────────────────────────

/**
 * Rental module rendering decision.
 *
 * full    — local-authority or better rent data available, with a meaningful property link
 * compact — benchmark-only data: show one-line note, not a multi-row card
 * hidden  — no useful rental basis whatsoever
 */
export function getRentalModuleDecision(
  rc: RentalContext,
  estimate: { low: number; mid: number; high: number } | null,
): ModuleDecision {
  // No valuation means no yield is calculable
  if (!estimate) {
    return {
      state: "hidden",
      copy:  null,
      ctaText: null,
      ctaUrl:  null,
      provenanceLabel: null,
    };
  }

  // Real local data — render the full card
  if (!rc.isBenchmarkOnly && rc.estimatedMonthlyRentGBP !== null) {
    return {
      state: "full",
      copy:  null,
      ctaText: null,
      ctaUrl:  null,
      provenanceLabel: rc.sourceGranularity === "postcode" || rc.sourceGranularity === "district"
        ? "Confirmed from official data"
        : "Derived from postcode benchmarks",
    };
  }

  // Benchmark-only (national 3.5–5.5% range or similar) — demote to one-line note
  // We never show 3 identical rows of hardcoded yields as if they're local data
  return {
    state: "compact",
    copy:  "No local rental data is available for this postcode. National gross yield benchmarks for similar UK properties typically range 3–6%, but this is not postcode-specific and should not be used for investment decisions.",
    ctaText: null,
    ctaUrl:  null,
    provenanceLabel: "Derived from postcode benchmarks",
  };
}

/** Compute gross yield % from annual rent and purchase price */
export function calcGrossYield(monthlyRentGBP: number, purchasePrice: number): string {
  if (purchasePrice <= 0) return "N/A";
  return ((monthlyRentGBP * 12) / purchasePrice * 100).toFixed(1);
}

// ─── EPC module decision ──────────────────────────────────────────────────────

/**
 * EPC rendering tiers:
 *  full    — subject EPC exists
 *  compact — no subject EPC, but local/area context available (future)
 *  warning — no useful EPC data at all
 *  hidden  — never; EPC is always at least a warning (trust matters)
 */
export function getEpcModuleDecision(
  epc: EpcData | null,
  meta: ModuleMetadata,
): ModuleDecision {
  // API returned a real EPC
  if (epc && meta.freshnessStatus !== "unavailable") {
    return {
      state: "full",
      copy:  epc.isExpired
        ? "This certificate has expired. Current energy performance may differ from these figures."
        : null,
      ctaText: null,
      ctaUrl:  null,
      provenanceLabel: "EPC register match found",
    };
  }

  // No EPC found — advisory only, never a big empty card
  return {
    state: "warning",
    copy:  "No EPC record was found for this address in the official register. This may mean the property predates mandatory EPC requirements, or no certificate has been lodged. Ask the seller for a valid EPC before relying on any energy assumptions.",
    ctaText: "Search the EPC register",
    ctaUrl:  "https://find-energy-certificate.service.gov.uk/",
    provenanceLabel: "Source coverage incomplete",
  };
}

// ─── Leasehold module decision ────────────────────────────────────────────────

/**
 * Leasehold rendering decision.
 *
 * hidden   — property is freehold or tenure is unknown (don't suggest leasehold issues)
 * full     — tenure confirmed leasehold + at least lease years known
 * compact  — tenure confirmed/inferred leasehold, but ALL lease terms missing
 * warning  — tenure is uncertain (could be leasehold, needs confirmation)
 */
export function getLeaseholdModuleDecision(l: LeaseholdSummary): ModuleDecision {
  // Freehold confirmed — hide entirely
  if (!l.isLeasehold && l.tenureConfidence !== "uncertain") {
    return { state: "hidden", copy: null, ctaText: null, ctaUrl: null, provenanceLabel: null };
  }

  // Tenure is genuinely uncertain — small warning, not a full leasehold card
  if (l.tenureConfidence === "uncertain") {
    return {
      state: "warning",
      copy:  "Tenure could not be confirmed from available comparable sales data. Verify whether this property is freehold or leasehold with your solicitor before proceeding.",
      ctaText: null,
      ctaUrl:  null,
      provenanceLabel: "Seller confirmation needed",
    };
  }

  // Leasehold confirmed or inferred
  if (l.isLeasehold) {
    const hasLeaseYears = l.leaseYearsRemaining !== null;
    const hasServiceCharge = l.serviceChargeEstGBP !== null || l.serviceChargeNote !== null;
    const hasGroundRent    = l.groundRentEstGBP !== null    || l.groundRentNote !== null;
    const knownMetrics     = [hasLeaseYears, hasServiceCharge, hasGroundRent].filter(Boolean).length;

    if (knownMetrics >= 1) {
      return {
        state: "full",
        copy:  null,
        ctaText: null,
        ctaUrl:  null,
        provenanceLabel: l.tenureConfidence === "confirmed"
          ? "Confirmed from Land Registry"
          : "Seller confirmation needed",
      };
    }

    // Leasehold confirmed, but ALL lease terms missing — compact warning only
    return {
      state: "compact",
      copy:  "Lease length, service charge, and ground rent are not available from public records. Request the full lease pack from the seller or their solicitor before making an offer.",
      ctaText: null,
      ctaUrl:  null,
      provenanceLabel: "Seller confirmation needed",
    };
  }

  return { state: "hidden", copy: null, ctaText: null, ctaUrl: null, provenanceLabel: null };
}

// ─── Property facts module decision ──────────────────────────────────────────

/**
 * Property facts rendering tiers:
 *  full    — 4+ confirmed fields
 *  compact — 2–3 confirmed fields (show those + "some details unavailable" note)
 *  minimal — 1–2 fields, but show as a small card + correction prompt
 *  hidden  — nothing confirmed at all
 *
 * We map minimal → "compact" state for the ModuleRenderState enum,
 * and add isMinimal flag for the component.
 */
export interface PropertyFactsDecision extends ModuleDecision {
  isMinimal:    boolean;
  confirmedRows: FieldRow[];
  inferredRows:  FieldRow[];
  missingCount:  number;
}

export function getPropertyFactsDecision(f: PropertyFacts): PropertyFactsDecision {
  const allRows: FieldRow[] = [
    { label: "Property type",   value: f.propertyType, provenance: "confirmed" },
    {
      label: "Tenure",
      value: f.tenure,
      provenance: f.tenureConfidence === "confirmed" ? "confirmed"
               : f.tenureConfidence === "inferred"   ? "inferred"
               : "unavailable",
      caveat: f.tenureConfidence === "inferred"
        ? "Inferred from comparable sales"
        : f.tenureConfidence === "uncertain"
        ? "Could not be confirmed — verify with solicitor"
        : undefined,
    },
    {
      label: "Floor area",
      value: f.floorAreaM2 ? `${f.floorAreaM2} m²` : null,
      provenance: "confirmed",
    },
    {
      label: "EPC band",
      value: f.epcBand,
      provenance: "confirmed",
    },
    {
      label: "Est. bedrooms",
      value: f.bedroomsEst,
      provenance: "inferred",
      caveat: f.bedroomsEst ? "Estimated from floor area" : undefined,
    },
    { label: "Council tax band", value: f.councilTaxBand, provenance: "confirmed" },
    { label: "Construction era", value: f.yearBuiltBand,  provenance: "inferred" },
  ];

  const confirmedRows = allRows.filter(r => r.value && r.provenance === "confirmed");
  const inferredRows  = allRows.filter(r => r.value && r.provenance === "inferred");
  const missingCount  = allRows.filter(r => !r.value).length;
  const confirmedCount = confirmedRows.length;
  const totalPopulated = confirmedCount + inferredRows.length;

  if (totalPopulated === 0) {
    return {
      state: "hidden", copy: null, ctaText: null, ctaUrl: null,
      provenanceLabel: null, isMinimal: false,
      confirmedRows: [], inferredRows: [], missingCount,
    };
  }

  if (confirmedCount >= 4) {
    return {
      state: "full", copy: null, ctaText: null, ctaUrl: null,
      provenanceLabel: "Confirmed from Land Registry",
      isMinimal: false, confirmedRows, inferredRows, missingCount,
    };
  }

  if (totalPopulated >= 3) {
    return {
      state: "compact",
      copy: `${missingCount} detail${missingCount !== 1 ? "s" : ""} not available from current public records.`,
      ctaText: null, ctaUrl: null,
      provenanceLabel: confirmedCount >= 2 ? "Confirmed from Land Registry" : "Source coverage incomplete",
      isMinimal: false, confirmedRows, inferredRows, missingCount,
    };
  }

  // 1–2 fields only — minimal card with correction prompt
  return {
    state: "compact",
    copy:  "Most property details are not available from current public records for this address.",
    ctaText: null, ctaUrl: null,
    provenanceLabel: "Source coverage incomplete",
    isMinimal: true, confirmedRows, inferredRows, missingCount,
  };
}

// ─── Re-export RentalContext for component use ────────────────────────────────
export type { RentalContext };
