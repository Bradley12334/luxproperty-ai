/**
 * postcodeUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared postcode normalisation helpers used by:
 *  - Brief entitlement lookups (brief.tsx)
 *  - Valuation entitlement lookups (valuation.tsx)
 *  - API entitlement resolver (api/valuation-entitlement.js)
 *
 * Single source of truth — do not duplicate this logic elsewhere.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Normalise a full UK postcode to a canonical spaced form, e.g.:
 *   "sw1a1aa"  → "SW1A 1AA"
 *   "SW1A1AA"  → "SW1A 1AA"
 *   "sw1a 1aa" → "SW1A 1AA"
 */
export function normaliseFullPostcode(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, "").trim();
  if (upper.length >= 5) {
    return upper.slice(0, -3) + " " + upper.slice(-3);
  }
  return upper;
}

/**
 * Extract the outcode (district) from a full postcode.
 * This is the part before the space, e.g.:
 *   "SW1A 1AA" → "SW1A"
 *   "BS1 4DJ"  → "BS1"
 *   "HA4 9NX"  → "HA4"
 *
 * Used as the canonical key for postcode_entitlements.postcode so that
 * a single Brief purchase covers all addresses within the same district.
 */
export function postcodeToOutcode(postcode: string): string {
  const normalised = normaliseFullPostcode(postcode);
  return normalised.split(" ")[0];
}

/**
 * Validate a postcode string looks like a UK postcode.
 * Accepts full postcodes (e.g. "SW1A 1AA") and outcode-only (e.g. "SW1A").
 */
export function isValidPostcodeFormat(s: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(s.trim());
}

/**
 * Tier priority helper — returns the higher of two plan tiers.
 */
export type PlanTier = "free" | "professional" | "investor";

const TIER_RANK: Record<PlanTier, number> = { free: 0, professional: 1, investor: 2 };

export function higherTier(a: PlanTier, b: PlanTier): PlanTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}
