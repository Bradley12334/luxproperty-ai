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
