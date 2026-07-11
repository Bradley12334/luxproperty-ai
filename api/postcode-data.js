/**
 * api/postcode-data.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single serverless function fronting three postcode data sources:
 *
 *   /api/broadband?postcode=…      → source=broadband
 *   /api/council-tax?postcode=…    → source=council-tax   (also ?type=dwelling-mix)
 *   /api/rental-market?postcode=…  → source=rental-market
 *
 * WHY THIS EXISTS — it is purely a packaging change, not a behaviour change.
 * Vercel's Hobby plan allows a maximum of 12 Serverless Functions per
 * deployment, and api/ was already at exactly 12. Adding api/billing-portal.js
 * (self-service subscription cancellation) pushed it to 13 and the build was
 * rejected outright.
 *
 * Rather than rewrite three working data endpoints, their handlers were moved
 * VERBATIM to lib/sources/*.js (outside api/, so Vercel no longer counts them as
 * functions) and are dispatched from here. The public URLs are unchanged —
 * vercel.json rewrites /api/broadband, /api/council-tax and /api/rental-market
 * onto this function with a `source` param, so no client code changed and the
 * original query string (including council-tax's ?type=dwelling-mix) is
 * preserved by the rewrite.
 *
 * Net function count: 12 − 3 + 1 (this) + 1 (billing-portal) = 11.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import broadband from "../lib/sources/broadband.js";
import councilTax from "../lib/sources/council-tax.js";
import rentalMarket from "../lib/sources/rental-market.js";

const SOURCES = {
  broadband,
  "council-tax": councilTax,
  "rental-market": rentalMarket,
};

export default async function handler(req, res) {
  const source = String(req.query.source || "").trim();
  const route = SOURCES[source];

  if (!route) {
    return res.status(400).json({
      error: "unknown source",
      expected: Object.keys(SOURCES),
    });
  }

  // Delegate to the original handler untouched — same req.query (postcode, type),
  // same response shape, same status codes.
  return route(req, res);
}
