/**
 * lib/brief/errors.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed errors for the brief data spine. Every failure path in the spine throws
 * a BriefError carrying a machine-readable `code` (never a bare Error, never a
 * silent fallback). Callers switch on `.code`; the UI/verdict layer (later
 * phases) turns these into honest "data incomplete" states rather than confident
 * output built on missing data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** @typedef {"INVALID_POSTCODE"|"UNSUPPORTED_NATION"|"VALIDATION_GUARD_FAILED"|"UPSTREAM_ERROR"|"BAD_INPUT"} BriefErrorCode */

export const ErrorCodes = Object.freeze({
  /** Input is not a syntactically/really valid UK postcode. */
  INVALID_POSTCODE: "INVALID_POSTCODE",
  /** Resolved to Scotland or Northern Ireland — England & Wales only. */
  UNSUPPORTED_NATION: "UNSUPPORTED_NATION",
  /** Reverse-geocode of the resolved coordinates did not return the requested outcode. */
  VALIDATION_GUARD_FAILED: "VALIDATION_GUARD_FAILED",
  /** An external API (Postcodes.io / Land Registry) failed or returned garbage. */
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  /** Programmer error — a module was called with an argument it cannot use. */
  BAD_INPUT: "BAD_INPUT",
});

export class BriefError extends Error {
  /**
   * @param {BriefErrorCode} code
   * @param {string} message
   * @param {Record<string, unknown>} [meta] structured context (never user-facing)
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "BriefError";
    this.code = code;
    this.meta = meta;
  }
}

/** Type guard for callers that catch. @returns {err is BriefError} */
export function isBriefError(err) {
  return err instanceof BriefError;
}
