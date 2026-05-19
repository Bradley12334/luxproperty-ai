import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const briefs = sqliteTable("briefs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  queryType: text("query_type").notNull(), // "postcode" | "address"
  data: text("data").notNull(), // JSON stringified report data
  createdAt: text("created_at").notNull(),
});

export const insertBriefSchema = createInsertSchema(briefs).omit({
  id: true,
});

export type InsertBrief = z.infer<typeof insertBriefSchema>;
export type Brief = typeof briefs.$inferSelect;

// Request/response types
export const generateBriefRequestSchema = z.object({
  query: z.string().min(1, "Please enter a postcode or address"),
});

export type GenerateBriefRequest = z.infer<typeof generateBriefRequestSchema>;

export interface AreaIntelligence {
  location: string;
  area: string;
  executiveSummary: string;
  marketOverview: {
    averagePrice: string;
    priceChangeYoY: string;
    avgDaysOnMarket: number;
    supplyLevel: string;
  };
  priceTrend: Array<{
    year: number;
    averagePrice: string;
    change: string;
  }>;
  neighbourhoodProfile: {
    schoolsRating: number;
    transportRating: number;
    safetyRating: number;
    walkability: number;
    // Rich descriptions
    character: string;          // Area personality / vibe
    amenities: string;          // Shops, restaurants, leisure
    greenSpace: string;         // Parks, nature, outdoor
    transport: string;          // Specific transport links
    schools: string;            // School info
    demographics: string;       // Who lives here
    nightlife: string;          // Evening / social scene
    marketComment: string;      // What buyers should know
    residentSentiment: string;  // What residents & buyers say — kept for backward compat
    residentSentimentBullets: Array<{
      type: "positive" | "trade-off" | "lifestyle" | "caution" | "note";
      text: string;
    }>;
    coverageThin: boolean; // true when data is inferred/limited rather than curated
  };
  investmentOutlook: {
    growthForecast: string;
    rentalYieldEstimate: string;
    riskFlags: string[];
  };
  verdict: string;

  /** Explorer verdict — simple area screening judgement for free tier */
  explorerVerdict: {
    label: "Good fit" | "Mixed" | "Limited fit";
    rationale: string; // 1–2 sentences, plain English
  };

  // ── Enrichment Data (Phase 2) ─────────────────────────────────────────────

  /** Flood & Climate Risk — EA flood zone + surface water + climate resilience */
  floodRisk: {
    zone: string;           // "Zone 1 (Low)", "Zone 2 (Medium)", "Zone 3 (High)"
    surfaceWater: string;   // "Low", "Medium", "High"
    riskBadge: "Low" | "Medium" | "High";
    detail: string;         // 1–2 sentence description
    // NEW — Climate & Resilience layer
    resilienceLabel: "Low risk" | "Some exposure" | "Elevated risk" | "High risk"; // overall verdict
    climateSignals: Array<{  // 2–4 factual climate/environmental signals
      label: string;         // e.g. "Subsidence sensitivity"
      value: string;         // e.g. "Moderate — London clay geology"
      context: string;       // plain-English buyer relevance sentence
      flagged: boolean;      // true if this signal warrants attention
    }>;
    nextSteps: string[];     // 2–4 practical buyer actions (what to check next)
  };

  /** Council Tax — most common band + annual cost */
  councilTax: {
    mostCommonBand: string; // "Band D"
    annualCost: string;     // "£1,842"
    borough: string;        // "Royal Borough of Kensington & Chelsea"
    note: string;           // Context sentence
  };

  /** Property Type Split — % breakdown */
  propertyTypeSplit: {
    flats: number;
    terraced: number;
    semiDetached: number;
    detached: number;
    other: number;
    dominantType: string;   // "Flats dominate at 71%"
  };

  /** Commute Calculator — key destinations */
  commuteTable: Array<{
    destination: string;
    time: string;
    mode: string;
    via: string;
  }>;

  /** Planning Activity — Professional+ */
  planningActivity: {
    recentApplications: number; // last 12 months
    majorDevelopments: string;  // Notable schemes
    developments?: Array<{ name: string; type: string; status: string; impact: string; detail: string }>;
    councilPortalUrl: string;
    note: string;
  };

  /** Rental Market Snapshot — Professional+ */
  rentalMarket: {
    oneBedAskingRent: string;   // "£1,850 pcm"
    twoBedAskingRent: string;   // "£2,600 pcm"
    threeBedAskingRent: string;
    oneBedYield: string;        // "3.8%"
    twoBedYield: string;
    demandLevel: string;        // "Very High", "High", "Moderate"
    note: string;
  };

  /** Broadband & Infrastructure — Professional+ */
  broadband: {
    avgDownloadSpeed: string;   // "220 Mbps"
    fullFibreAvailability: string; // "89%"
    rating: "Excellent" | "Very Good" | "Good" | "Moderate" | "Limited" | "Fair" | "Poor";
    providers: string;          // "Openreach, Virgin Media, Hyperoptic"
    note: string;
  };

  /** Air Quality — Professional+ */
  airQuality: {
    no2Level: string;           // "28 µg/m³"
    pm25Level: string;          // "12 µg/m³"
    rating: "Good" | "Moderate" | "Poor" | "Very Poor";
    note: string;
  };

  /** Rental Demand Score — Investor */
  rentalDemand: {
    avgDaysToLet: number;
    vsNationalAvg: string;      // "4x faster than national average"
    score: number;              // 1–10
    note: string;
  };

  /** Nearby Development Tracker — Professional+ */
  nearbyDevelopments: Array<{
    name: string;
    type: string;               // "Residential", "Transport", "Commercial", "Mixed-use", "Road/Access", "Infrastructure"
    status: string;             // "Under construction", "Planning approved", "Proposed", "Pre-application"
    impact: "Positive" | "Neutral" | "Monitor";  // legacy compat
    impactLabel: "upside" | "disruption" | "mixed" | "unclear"; // NEW: buyer-facing classification
    impactRationale: string;    // NEW: plain-English sentence explaining why it matters
    distanceM?: number;         // NEW: approximate metres from subject property/postcode
    detail: string;
  }>;

  /** Sold Prices Map data — Investor */
  recentSoldPrices: Array<{
    address: string;
    price: string;
    date: string;
    type: string;
    lat: number;
    lng: number;
  }>;

  // ── Local Amenities (live data) ──────────────────────────────────────────────
  nearbyStations: Array<{
    name: string;
    lines: string[];
    modes: string[];
    distanceMetres: number;
    walkMins: number;
    lat?: number;
    lng?: number;
  }>;

  nearbySchools: Array<{
    name: string;
    type: string;         // "Primary" | "Secondary" | "Independent" etc.
    ofstedRating: string; // "Outstanding" | "Good" | "Requires Improvement" | "Inadequate" | "Not yet rated"
    distanceMetres: number;
    walkMins: number;
    lat?: number;
    lng?: number;
  }>;

  nearbyAmenities: {
    supermarkets: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
    cafesAndRestaurants: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
    health: Array<{ name: string; type: string; distanceMetres: number; lat?: number; lng?: number }>;
    greenSpaces: Array<{ name: string; distanceMetres: number; walkMins: number; lat?: number; lng?: number }>;
  };

  crimeStats: {
    totalCrimesPerMonth: number;
    topCategories: Array<{ category: string; count: number; pct: number }>;
    vsNationalNote: string;
    date: string;
  };

  /** Red-flag summary — Professional+. Material risks surfaced prominently. */
  redFlags: Array<{
    label: string;
    detail: string;
    severity: "high" | "medium";
  }>;

  /**
   * Lifestyle fit scoring — Professional+.
   * Five evidence-led categories showing how well an area suits different
   * ways of living. Each category has a banded label + plain-English caption.
   */
  lifestyleFit: Array<{
    /** Category name — one of five fixed categories */
    category:
      | "Family life"
      | "Commute convenience"
      | "Walkability"
      | "Access to green space"
      | "Daily convenience";
    /** Banded score — not a fake precise number */
    score: "Excellent" | "Good" | "Mixed" | "Limited";
    /** One-sentence plain-English caption: what daily life actually feels like */
    caption: string;
  }>;

  /**
   * Structured "Would I buy here?" verdict — Professional+.
   * Derived from actual evidence in the brief. Replaces the generic
   * BuyerSummary readout as the headline decision layer.
   */
  buyerVerdict: {
    /** Headline judgement — one of four calibrated labels */
    verdictLabel: "Strong case" | "Good case" | "Proceed carefully" | "Thin data — verify first";
    /** One-sentence verdict rationale — the most decisive evidence */
    verdictRationale: string;
    /** Buyer profile most suited to this area/property */
    bestFor: string;
    /** Up to 3 specific, evidence-led positives */
    strongestPositives: string[];
    /** Up to 3 specific, decision-relevant risks or trade-offs */
    mainWatchOuts: string[];
    /** Evidence quality: High / Moderate / Low */
    confidenceLevel: "High" | "Moderate" | "Low";
    /** One sentence explaining what drives the confidence level */
    confidenceNote: string;
  };
}

export interface PropertyDeepDive {
  valuationAssessment: {
    estimatedRange: string;
    priceVsAreaAverage: string;
    valueScore: string;
  };
  comparableSales: Array<{
    address: string;
    price: string;
    date: string;
    type: string;
  }>;
  /** Legacy — preserved for backwards compat with old brief store entries */
  negotiationBrief: {
    suggestedOfferRange: string;
    leveragePoints: string[];
  };
  /** New: evidence-led offer strategy block */
  offerStrategy: {
    /** How much to trust the numbers: "Strong" | "Moderate" | "Thin" */
    confidence: "Strong" | "Moderate" | "Thin";
    /** 1-sentence explanation of what drives the confidence level */
    confidenceNote: string;
    /** Fair value range derived from comparables + area median */
    fairValueRange: string;             // e.g. "£340,000 – £370,000"
    /** Where a buyer could reasonably open negotiations */
    openingRange: string;               // e.g. "£315,000 – £330,000"
    /** Narrative: how we got to these numbers */
    rationale: string;
    /** Factors that may support a firmer buyer stance */
    sellerPressurePoints: string[];
    /** Questions to raise before making an offer */
    preOfferQuestions: string[];
  };
}

export interface BriefReport {
  id: number;
  query: string;
  queryType: "postcode" | "address";
  generatedAt: string;
  areaIntelligence: AreaIntelligence;
  propertyDeepDive?: PropertyDeepDive;
  // Location coords for map
  lat?: number;
  lng?: number;
}
