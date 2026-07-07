# Brief Logic Rules — refinement notes

Plain-English record of the rules the brief uses, and the ones changed in the
Group 1 (consistency) pass. Tweak the thresholds here, then change them in code
at the referenced spot. No data sources, architecture, or generation flow were
changed — these are layout/copy/logic/consistency refinements only.

Canonical numbers are computed **once** in `generateBrief` (`client/src/lib/mockEngine.ts`)
and every section reads those same values:
- `latestMedian` → `marketOverview.averagePrice` (via `fmt`)
- `yoyChange` — carries its own `+`/`-` sign
- `fiveYearGrowth` — magnitude only (e.g. `-35.3%` when negative, `35.3%` when positive)
- `fiveYearGrowthSigned` — **new**: canonical signed presentation of the multi-year figure

---

## Group 1 changes (this pass)

### 1 / 6 — One source of truth + no doubled signs
- Added `fiveYearGrowthSigned` next to `fiveYearGrowth` (mockEngine ~L2826). It adds a
  `+` only when the value isn't already negative. Every "+X%" style display now reads
  this instead of prefixing its own `+`. Fixed the `+-35.3%` outputs in the executive
  summary and the homepage `priceVsAreaAverage` card.
- `street-price-ranking.tsx` premium list now prints the native sign (`{pct >= 0 ? "+" : ""}`)
  so a below-average street can't render `+-8%`.
- Removed the dead `deriveBuyerSummary` + `BuyerSummary` interface from `brief.tsx`
  (never called; duplicated verdict logic with different thresholds — a future
  divergence trap). The live verdict comes only from `deriveVerdict` (mockEngine).

**Rule:** any signed percentage is formatted once at its source; call sites never add a sign.

### 2 — Explain legitimate price gaps
- The Valuation card's **Estimated Range** is a band around the area median
  (`median × 0.90–1.15`). The Offer Strategy's **Fair Value Range** blends in specific
  comparables (see below). These can differ by design. Added one line in the valuation
  card saying so, so the gap never reads as a contradiction.
- `suggestedOfferRange` now carries its `(88–97% of <area> median)` label like the others.

### 3 — Top strengths must be backed by their own section
- The verdict's school positive is now gated on **real Ofsted data**, never the synthetic
  `schoolsRating` alone (mockEngine, `deriveVerdict`). It fires only when there is a named
  Good/Outstanding school, or ≥2 Good/Outstanding-rated schools actually in the data.
  Previously it could claim "above-average school provision" in exactly the case where no
  rated school existed — contradicting the "School data limited" schools section.

**Rule to generalise later:** a data point may headline as a strength only if its detailed
section would independently show it as a positive.

### 4 — Deduplicate lists
- Added `dedupeBy(items, keyFn)` + `placeKey(name, lat, lng)` helpers (mockEngine).
  `placeKey` treats same-name items within ~110m (coords at 3dp) as one place, so node/way/
  relation duplicates from Overpass collapse but genuinely distinct branches of a chain survive.
- Applied to: schools (dedupe by place, keep nearest), all amenity categories
  (supermarkets/cafes/health/greenSpaces), developments (by name), comparables and recent
  sold prices (by address+price+date), and station `lines` (by lowercase value).
  Stations were already deduped upstream.

**Rule:** dedupe upstream where the array is built (keeping the nearest instance after a
distance sort), not at each render site.

### 5 — No broken/half-rendered sentiment strings
- Rewrote the curated path of `deriveResidentSentimentBullets` (mockEngine). It no longer
  prepends framing ("Residents often describe …") onto an already-complete sentence or
  lowercases the first word (which mangled proper nouns and produced fragments like
  "Sentiment appears mixed on the main complaint is parking"). Now:
  - the curated sentence is emitted verbatim (the UI type-chip supplies the framing);
  - `cleanSentence` rejects fragments that aren't clean standalone sentences
    (must start sentence-initial, length ≥ 25 chars);
  - bullets are de-duplicated by text;
  - if the curated parse yields < 2 clean bullets, it **falls through** to the data-driven
    path rather than render a thin section.

### 7 — Honestly label borrowed (out-of-postcode) readings
- Live DEFRA air-quality readings now surface the nearest-monitor name **and distance**
  (`distKm`, already computed in `api/air-quality.js`) with an explicit
  "Indicative only — reading is from the closest DEFRA station, not the postcode itself."
- Verdict watch-outs no longer strip the `(est.)` marker from estimated NO₂ figures.
- The "clean air" top positive is softened to "clean air likely — area-type estimate…"
  when the reading is an estimate rather than a live monitor value.
- Removed a hardcoded "Source: DEFRA modelling" caption that mislabelled live readings; the
  honest source now lives in the note. Also removed a doubled `µg/m³` unit in the render.

---

## Existing rules (unchanged — for reference when refining)

### Median & confidence gates
- `median(prices)` requires **≥ 5** sales or returns 0 (mockEngine ~L2579). `hasData` = `latestMedian > 0`.
- `demandSignal`: High > 40 sales / Moderate > 15 / else Low (most recent year).
- Year window is pinned to `LAND_REGISTRY_BASE_YEAR = 2025` (deliberate, not clock-driven).
- Plan history: explorer 1 yr, professional 5 yr, investor 10 yr.

### Comparable selection
- `fetchRecentTransactions` prefers exact-outcode matches, falls back to district level.
- Comparables = deduped `recentTxns`, top 4.

### Range calculation (property/offer path)
- `fairValueAnchor` = (comps ≥ 2) ? `round(median×0.4 + compAvg×0.6)` : `median`.
- Fair Value Range = anchor × 0.92 – 1.08.
- Opening Range = anchor × (soft market 0.86–0.94 / high demand 0.90–0.96 / else 0.88–0.95).
  Soft market = YoY not positive and not "—".
- Estimated Range (valuation card) = median × 0.90 – 1.15.
- Suggested Offer Range = median × 0.88 – 0.97.

### Verdict thresholds (mockEngine `deriveVerdict`)
- YoY: ≥ 4% strong growth · > 0 steady/rising · < 0 to ≥ -2 slight softening · < -2 falling.
- Market tier by `latestMedian`: > £1.5m prime · > £700k premium · > £350k mid-market · > 0 emerging.
- Station positive: ≤ 8 min walk (or ≤ 14 min with transportRating ≥ 6).
- Flood: Low = positive; Medium/High = watch-out.

### Open items for later groups
- Group 3 (#11–14): conditional-render every section, widen comparable radius with a stated
  "nearest N sales within X miles", segment ranges by property type using the median (and
  £/m² where floor area exists), and always show sample sizes ("based on N sales").
  These are **not** done yet.
