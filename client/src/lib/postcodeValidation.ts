/**
 * postcodeValidation.ts
 *
 * Minimal, non-destructive postcode validation helpers.
 * Does NOT alter any existing data, scoring, or business logic.
 * Used only by the search bar to reject clearly invalid inputs before
 * they reach generateBrief.
 */

/**
 * Full postcode regex — matches all Royal Mail formats including EC/WC specials.
 * Accepts with or without the internal space, case-insensitive.
 * More permissive than strict PAF to avoid false-rejections on valid postcodes.
 * Structural sanity: must start with a letter, have digit(s) in the middle,
 * and end with digit + two letters.
 */
const FULL_POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

/**
 * Outcode-only: 2–4 chars, letter(s) then digit(s) then optional letter.
 * Covers: M1 E8 SW3 EC2V W1A SE15 LS6 etc.
 */
const OUTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i;

/**
 * Invalid area-code guard: rejects strings that structurally look like a postcode
 * but whose area letter combination is provably not used in the UK.
 * Only blocks the most obvious non-UK patterns (all-digit area, single invalid letter combos).
 * Fine-grained Royal Mail area validation is left to postcodes.io at query time.
 */
const OBVIOUS_INVALID_AREA_RE = /^[0-9]/; // starts with digit — never valid for UK postcode

/**
 * Minimum-length guard: anything under 2 chars is obviously not a postcode.
 */
const MIN_LENGTH = 2;

export type PostcodeValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Validates a raw user-typed string as a UK postcode (full or outcode).
 * Returns { valid: true } when acceptable, or { valid: false, reason } when not.
 *
 * Deliberately permissive on format (case, spaces) — only hard-rejects strings
 * that cannot possibly be a UK postcode. Full validation is left to postcodes.io
 * inside generateBrief; this is a client-side pre-flight check only.
 */
export function validatePostcodeInput(raw: string): PostcodeValidationResult {
  const trimmed = raw.trim();

  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, reason: "Please enter a UK postcode or outcode." };
  }

  // Allow partial address strings that contain an embedded postcode
  // (e.g. "14 High Street, SW1A 1AA") — extractPostcode handles these.
  // Only reject strings that have no postcode-like segment at all.
  const embeddedPostcode =
    trimmed.match(/[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}/i) ||
    trimmed.match(/[A-Z]{1,2}[0-9][A-Z0-9]?/i);

  // Pure postcode inputs (no spaces or non-alphanumeric except the internal space)
  // Free-text with non-alphanumeric chars (e.g. "14 High Street, SW1A 1AA") — accept if it
  // contains any recognisable postcode or outcode token anywhere in the string.
  const looksLikeRawPostcode = /^[A-Z0-9\s]+$/i.test(trimmed);

  if (!looksLikeRawPostcode) {
    // Accept if there's an embedded full postcode or outcode token
    if (embeddedPostcode) return { valid: true };
    const hasOutcodeToken = /\b[A-Z]{1,2}[0-9][A-Z0-9]?\b/i.test(trimmed);
    if (hasOutcodeToken) return { valid: true };
    return {
      valid: false,
      reason:
        "Please include a UK postcode in your search — for example: 14 High Street, SW1A 1AA.",
    };
  }

  // Pure alphanumeric input — apply structural checks
  const noSpace = trimmed.replace(/\s+/g, "");

  // All digits — definitely not a postcode
  if (/^\d+$/.test(noSpace)) {
    return {
      valid: false,
      reason: "That doesn't look like a UK postcode. Try something like SW3 1AA or LS6.",
    };
  }

  // "Chelsea SW3"-style: two space-separated tokens where second is an outcode
  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2) {
    const lastToken = tokens[tokens.length - 1];
    // Last token is a full postcode incode (e.g. "SW3", "EC2V") — accept
    if (OUTCODE_RE.test(lastToken) || FULL_POSTCODE_RE.test(tokens.slice(-2).join(" "))) {
      return { valid: true };
    }
    // Last two tokens form a valid full postcode
    if (tokens.length >= 2 && FULL_POSTCODE_RE.test(`${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`)) {
      return { valid: true };
    }
  }

  // Long enough to be intended as a full postcode but doesn't match
  if (noSpace.length >= 5 && !FULL_POSTCODE_RE.test(trimmed)) {
    return {
      valid: false,
      reason: `"${trimmed}" isn't a recognised UK postcode format. Try SW3 1AA or LS6 2EX.`,
    };
  }

  // Outcode-length string that doesn't match outcode pattern
  if (noSpace.length <= 4 && !OUTCODE_RE.test(trimmed)) {
    return {
      valid: false,
      reason: `"${trimmed}" isn't a recognised UK outcode. Try SW3, LS6, or EC2V.`,
    };
  }

  return { valid: true };
}
