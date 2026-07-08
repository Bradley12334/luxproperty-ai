# Hide empty sections / kill placeholders — notes

Goal: a finished brief never shows "loading", "no data", empty tables, or half-filled
strings. Sections with no usable data are hidden or reduced to one honest line. Rendering
only — no data source or fetch logic changed.

## Fixes this pass
1. **"…is loading" captions removed** (`client/src/lib/mockEngine.ts`, Lifestyle Fit —
   Commute / Convenience / Green Space fallbacks). Generation is *complete* by render time,
   so "Live station data is loading", "…once data loads", "Green space data is loading…"
   were simply false and also pointed users to sections that were themselves empty. Rewritten
   to honest area-level wording ("…based on the area's transport/walkability profile",
   "specific green-space data wasn't available for this postcode").
2. **Air quality readings hidden when absent** (`brief.tsx`, on-screen render + PDF/HTML
   export). A live DEFRA monitor can report NO₂ but not PM2.5 (→ literal "No data"). Each
   NO₂/PM2.5 tile now renders only when the value is real; the grid reflows and the Rating
   (still meaningful) stays. No more "PM2.5: No data".
3. **Local Amenities hidden when every category is empty** (`brief.tsx`). Previously guarded
   only on the object existing, so an all-empty Overpass result rendered an empty section.
   Now requires ≥1 item across supermarkets/cafés/health/green spaces.
4. **Rental Demand rewired + hidden when insufficient** (`brief.tsx`, Investor). BUG found:
   the markup referenced fields that don't exist on `rentalDemand`
   (`demandLevel/voidRisk/tenantProfile/supplyTrend`) — the schema has
   `label/score/avgDaysToLet/vsNationalAvg/confidence/rationale/note`. Because the build uses
   esbuild (no typecheck), this shipped and rendered **"—" on all four tiles for every
   postcode**, not just thin-data ones. Now renders the real fields, drops any null tile, and
   hides the whole section when `confidence === "Insufficient"` or `label === "Insufficient
   evidence"`.

## Already handled (earlier consistency pass — verified, not re-done)
- Borrowed air-quality reading labelled with monitor name + distance + "Indicative only".
- Resident-quote fragments: `cleanSentence` rejects non-standalone fragments; the curated
  path falls through to the data-driven path when it can't produce clean bullets.
- School top-line "positive" gated on real Ofsted data.

## Already guarded (verified)
- Nearby Stations, Nearby Schools — wrapped in `length > 0`. Walk Score — guarded.
- Schools show honest per-item "No current rating" and a one-line "School data limited"
  when Ofsted is absent — acceptable single-line states per the task's §3; left as-is.

## Not done / flagged
- A FULL section-by-section audit across thin-data postcodes needs the app running
  (no Node/browser here). The fixes above cover the named examples + the empty-render cases
  I could confirm by reading. Other sections (planning, broadband, climate, etc.) show
  honest one-line states rather than broken widgets, but should be eyeballed on rural
  postcodes during verification.

## Verify before merge (NOT run here)
Generate: SW3 1AA (dense), 2–3 suburban across regions, a small-town, and ≥2 rural/thin
(incl. a Welsh one, e.g. LL/ SA / LD outcode). Confirm: no "loading"/"no data"/empty tables/
half-strings; air-quality tiles hide cleanly; amenities section absent when Overpass is
empty; Rental Demand shows real values for a data-rich Investor view and is absent (not
"—") for thin ones; layout reads clean on mobile with sections removed. Report which
sections were hidden per thin-data postcode.
