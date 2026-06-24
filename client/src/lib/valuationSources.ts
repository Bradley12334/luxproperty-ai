/**
 * valuationSources.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry of every data source used in the Property Valuation product.
 *
 * Rules:
 *  - Never add a source here without documenting its lag, licence, and fallback.
 *  - Never fabricate a trust level — if you don't know, set it to "licensed".
 *  - Every module that renders a number MUST reference a source from this file.
 *  - If a source endpoint changes, update ONE place here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type TrustLevel = "official" | "licensed" | "derived";
export type FreshnessStatus = "fresh" | "delayed" | "stale" | "unavailable";

export interface DataSource {
  /** Unique key referenced by ValuationModuleMetadata */
  id: string;
  /** Human-readable source name shown in the UI */
  displayName: string;
  /** URL shown in attribution */
  url: string;
  /**
   * official  = UK government open data (HM Land Registry, MHCLG, HMRC)
   * licensed  = third-party licensed data (Homedata.co.uk, etc.)
   * derived   = computed from official data (SDLT calculation, trend interpolation)
   */
  trustLevel: TrustLevel;
  /**
   * How often the upstream dataset is updated — not how often we fetch it.
   * Land Registry PPD: "monthly" (published ~20th working day each month)
   * UKHPI: "monthly"
   * EPC: "daily" (applications processed daily by MHCLG)
   * planning.data.gov.uk: "continuous" (LPAs push data as decisions are made)
   */
  refreshCadence: string;
  /**
   * Typical lag between the real-world event and this data source reflecting it.
   * Land Registry PPD: 2–8 weeks typical, up to 3 months for new builds.
   * UKHPI: 4–6 weeks after the month ends.
   * EPC: a few days after lodgement.
   * planning.data.gov.uk: variable — depends on LPA submission.
   */
  typicalLagNote: string;
  /** Licence under which data is available */
  licence: string;
  /**
   * Where to go if this source is unavailable or returns no usable data.
   * null = no fallback; suppress the module and show unavailable state.
   */
  fallbackId: string | null;
}

export const DATA_SOURCES: Record<string, DataSource> = {

  // ── HM Land Registry: Price Paid Data ──────────────────────────────────────
  // Used for: comparable sold prices, last sold price, transaction history.
  // Endpoint: SPARQL at https://landregistry.data.gov.uk/landregistry/query
  //   or bulk CSV at https://pp.landregistry.gov.uk/app/api/
  // Practical approach: query SPARQL for recent transactions in a postcode;
  //   each row contains paon, saon, street, town, postcode, price, date, type,
  //   tenure (freehold/leasehold), category (new build / resale).
  // Update schedule: published on the 20th working day of each month.
  // Lag: typically 2 weeks to 2 months between completion and registration.
  //   New builds can be 3+ months. The two most recent months are ALWAYS
  //   incomplete — do NOT claim completeness for them.
  // Licence: Open Government Licence v3.0
  hmlr_ppd: {
    id: "hmlr_ppd",
    displayName: "HM Land Registry Price Paid Data",
    url: "https://landregistry.data.gov.uk/app/ppd",
    trustLevel: "official",
    refreshCadence: "Monthly (20th working day)",
    typicalLagNote:
      "2 weeks to 2 months between completion and registration. New builds may take 3+ months. The two most recent calendar months in the dataset are always incomplete.",
    licence: "Open Government Licence v3.0",
    fallbackId: "homedata_sales",
  },

  // ── HM Land Registry: UK House Price Index ─────────────────────────────────
  // Used for: postcode-district price trend (12-month chart), YoY % change.
  // Endpoint: REST API at https://landregistry.data.gov.uk/data/ukhpi/region/{slug}
  //   or SPARQL at http://landregistry.data.gov.uk/landregistry/query
  //   UKHPI regions use slug identifiers e.g. /data/ukhpi/region/south-west
  //   Postcode-district level is NOT available in UKHPI — it covers local
  //   authority / county / region. Closest granularity: local authority.
  // Update schedule: monthly, with ~4–6 week lag after the reference month.
  // Licence: Open Government Licence v3.0
  hmlr_ukhpi: {
    id: "hmlr_ukhpi",
    displayName: "HM Land Registry UK House Price Index",
    url: "https://landregistry.data.gov.uk/app/ukhpi",
    trustLevel: "official",
    refreshCadence: "Monthly (~4–6 weeks after the reference month)",
    typicalLagNote:
      "Published monthly. A June 2025 figure is typically available by late August 2025. Do not present these figures as current-month data.",
    licence: "Open Government Licence v3.0",
    fallbackId: "homedata_trends",
  },

  // ── MHCLG: Energy Performance Certificates ─────────────────────────────────
  // Used for: EPC band, energy score, floor area.
  //
  // IMPORTANT — ENDPOINT MIGRATION:
  //   The legacy endpoint epc.opendatacommunities.org was CLOSED on 30 May 2026.
  //   The new official endpoint is:
  //     https://get-energy-performance-data.communities.gov.uk
  //   Current EPC API key for LuxProperty: ad0c49cd5dc496b87380d9273b333410fbeadc56
  //   Credentials: bradleyskana@hotmail.com
  //
  //   If the official endpoint is also unavailable or rate-limited beyond our
  //   usage tier, fall back to homedata_epc (same MHCLG data, stable API).
  //
  // Update schedule: daily (as EPC lodgements are processed).
  // Lag: a few days after a new EPC is lodged.
  // Licence: Open Government Licence v3.0
  mhclg_epc: {
    id: "mhclg_epc",
    displayName: "MHCLG Energy Performance Certificates",
    url: "https://get-energy-performance-data.communities.gov.uk",
    trustLevel: "official",
    refreshCadence: "Daily (as lodgements are processed)",
    typicalLagNote:
      "EPC data is typically available within a few days of lodgement. Properties with no EPC on record have never been assessed or had an expired assessment — do not infer an energy rating.",
    licence: "Open Government Licence v3.0",
    fallbackId: "homedata_epc",
  },

  // ── Homedata.co.uk: EPC (fallback) ─────────────────────────────────────────
  // Used as fallback if mhclg_epc is unavailable.
  // Same underlying MHCLG data, different stable API endpoint.
  // Requires API key. Free tier: 100 calls/month.
  homedata_epc: {
    id: "homedata_epc",
    displayName: "Homedata EPC API (MHCLG data)",
    url: "https://homedata.co.uk/data/epc",
    trustLevel: "licensed",
    refreshCadence: "Daily (mirrors MHCLG EPC register)",
    typicalLagNote:
      "Same lag as MHCLG EPC (a few days after lodgement). Homedata acts as a stable proxy for the official data.",
    licence: "MHCLG Open Government Licence (served by Homedata commercial API)",
    fallbackId: null,
  },

  // ── Homedata.co.uk: Sales & Trends (fallback for PPD/UKHPI) ───────────────
  // Used if the Land Registry SPARQL endpoint is slow or times out.
  // Homedata wraps Land Registry data in clean JSON with outcode-level trend
  // and UPRN-level sales history.
  homedata_sales: {
    id: "homedata_sales",
    displayName: "Homedata Property Sales API (Land Registry data)",
    url: "https://homedata.co.uk/data/prices-transactions",
    trustLevel: "licensed",
    refreshCadence: "Monthly (mirrors Land Registry PPD monthly updates)",
    typicalLagNote:
      "Mirrors HM Land Registry PPD lag: 2 weeks to 2 months. Trend data cached 24 hours.",
    licence: "MHCLG Open Government Licence (served by Homedata commercial API)",
    fallbackId: null,
  },

  homedata_trends: {
    id: "homedata_trends",
    displayName: "Homedata Price Trends API (Land Registry data)",
    url: "https://homedata.co.uk/data/prices-transactions",
    trustLevel: "licensed",
    refreshCadence: "Monthly (mirrors UKHPI)",
    typicalLagNote:
      "Mirrors HM Land Registry UKHPI lag: ~4–6 weeks after the reference month.",
    licence: "MHCLG Open Government Licence (served by Homedata commercial API)",
    fallbackId: null,
  },

  // ── planning.data.gov.uk (MHCLG) ───────────────────────────────────────────
  // Used for: planning applications within ~200m of the property.
  // Endpoint: https://www.planning.data.gov.uk/entity.json?dataset=planning-application&q={postcode}
  // Coverage: voluntary — not all LPAs submit. Coverage is improving.
  //   Flag incomplete coverage to the user — never claim exhaustive results.
  // Update schedule: continuous (LPAs push when they publish decisions).
  // Licence: Open Government Licence v3.0
  planning_data_gov: {
    id: "planning_data_gov",
    displayName: "Planning Data (MHCLG)",
    url: "https://www.planning.data.gov.uk",
    trustLevel: "official",
    refreshCadence: "Continuous (LPA submissions; coverage varies by authority)",
    typicalLagNote:
      "Coverage is incomplete — not all local planning authorities submit data to this platform. Absence of results does not mean no applications exist. Always caveat.",
    licence: "Open Government Licence v3.0",
    fallbackId: null,
  },

  // ── HMRC / GOV.UK: Stamp Duty Land Tax ─────────────────────────────────────
  // Used for: SDLT estimate on purchase price.
  // NOTE: SDLT rates are CALCULATED from published legislation, not fetched
  //   from a live API. We embed the rates from GOV.UK as a static lookup table.
  //   Rates effective from 1 April 2025 (following Autumn Budget 2024).
  //   Source: https://www.gov.uk/stamp-duty-land-tax/residential-property-rates
  //   These rates change only via legislation — update when Parliament changes them.
  //   Always display the effective date and a link to GOV.UK for verification.
  hmrc_sdlt: {
    id: "hmrc_sdlt",
    displayName: "HMRC Stamp Duty Land Tax (GOV.UK)",
    url: "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates",
    trustLevel: "official",
    refreshCadence: "Changes only via legislation (last change: 1 April 2025)",
    typicalLagNote:
      "SDLT rates are embedded from the GOV.UK published rates. We do not call a live API. Verify the current rates at GOV.UK before relying on this figure.",
    licence: "Open Government Licence v3.0",
    fallbackId: null,
  },

  // ── Postcodes.io ────────────────────────────────────────────────────────────
  // Used for: converting postcode to lat/lng, local authority, region.
  //   Required for UKHPI region lookups and planning API geo queries.
  // Endpoint: https://api.postcodes.io/postcodes/{postcode}
  // Free, no authentication, open source.
  postcodes_io: {
    id: "postcodes_io",
    displayName: "Postcodes.io",
    url: "https://postcodes.io",
    trustLevel: "official",
    refreshCadence: "Updated with each ONS Postcode Directory release (~quarterly)",
    typicalLagNote:
      "Postcode directory updates lag behind Royal Mail by a few months. Terminated postcodes may briefly resolve incorrectly.",
    licence: "Open Government Licence v3.0",
    fallbackId: null,
  },
};

// ─── Module metadata shape ─────────────────────────────────────────────────────

export interface ModuleMetadata {
  /** Which source in DATA_SOURCES provided this data */
  sourceId: string;
  /** ISO date string of when the source itself says this data was published/updated */
  publishedAt: string | null;
  /** ISO date string of when WE retrieved this data */
  retrievedAt: string;
  /** Overall freshness assessment */
  freshnessStatus: FreshnessStatus;
  /**
   * Short copy shown to the user in the UI explaining data state.
   * Keep to one sentence. Honest over impressive.
   */
  caveatText: string;
}

// ─── Freshness thresholds ──────────────────────────────────────────────────────
// Used by the data engine to automatically assign freshnessStatus.

export const FRESHNESS_THRESHOLDS = {
  // PPD: fresh if retrieved within 35 days (one monthly cycle + buffer).
  //   stale if > 90 days. Everything between is "delayed".
  hmlr_ppd:   { freshDays: 35, staleDays: 90 },
  hmlr_ukhpi: { freshDays: 45, staleDays: 120 },
  mhclg_epc:  { freshDays: 7,  staleDays: 30 },
  homedata_epc: { freshDays: 7, staleDays: 30 },
  homedata_sales: { freshDays: 35, staleDays: 90 },
  homedata_trends: { freshDays: 45, staleDays: 120 },
  planning_data_gov: { freshDays: 14, staleDays: 60 },
  hmrc_sdlt: { freshDays: 365, staleDays: 730 }, // legislation-only changes
  postcodes_io: { freshDays: 90, staleDays: 180 },
} as const;

export function assessFreshness(
  sourceId: string,
  publishedAtIso: string | null
): FreshnessStatus {
  if (!publishedAtIso) return "unavailable";
  const thresholds = FRESHNESS_THRESHOLDS[sourceId as keyof typeof FRESHNESS_THRESHOLDS];
  if (!thresholds) return "unavailable";
  const ageMs = Date.now() - new Date(publishedAtIso).getTime();
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= thresholds.freshDays) return "fresh";
  if (ageDays <= thresholds.staleDays) return "delayed";
  return "stale";
}
