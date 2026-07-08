# Internal-consistency audit — findings, fixes, and one decision needed

## TL;DR
Most in-brief consistency (single-source figures, doubled signs, dedupe, school
highlight gating, air-quality labelling, fair-value explanation) was already done in
the earlier "Group 1" pass — see [BRIEF_LOGIC_NOTES.md](BRIEF_LOGIC_NOTES.md). This
pass diagnosed the **flagship contradiction** (homepage/area £1.38M vs brief £845k for
SW3) and made the safe fixes. But the median contradiction's real root cause is a
**methodology decision that changes how the figure is computed** — flagged below
rather than guessed, per the task's own constraint.

## Single source of truth (already canonical, in-brief) — `client/src/lib/mockEngine.ts`
Computed once in `generateBrief`, read everywhere:
- `latestMedian` → `marketOverview.averagePrice` (via `fmt`)
- `yoyChange` — carries its own sign
- `fiveYearGrowth` (magnitude) / `fiveYearGrowthSigned` (canonical signed) — fixes `+-35.3%`
- Verdict/shortlist/confidence derive from these + `totalSalesThisYear` (data density):
  `confidenceLevel = Low` when `totalSalesThisYear < 3`, etc.
Sign/sentiment guards already present: "strong appreciation" only fires on `+` (L1307);
`marketStrong` positives require a positive trend. No negative-as-appreciation path found
in the current code — the reported "-5yr described as appreciation" was the old `+-35.3%`
formatting bug (now fixed) compounded by the median issue below.

## Flagship contradiction: £1.38M vs £845k for SW3 — ROOT CAUSE
It is **not** two divergent copies of one number. It's three different things:
1. **Median is computed at ADMINISTRATIVE-DISTRICT level, recency-capped.**
   `fetchLandRegistryYear(district, year)` (L1968) queries Land Registry by
   `propertyAddress.district` (e.g. all of *Kensington & Chelsea*) with
   `_pageSize=100&_sort=-transactionDate` — i.e. the **median of the 100 most-recently-
   registered district sales that year**, not the searched outcode, and not a full-sample
   median. For a large mixed district this is unrepresentative (→ ~£845k for SW3).
2. **Comparables / fair-value are computed at OUTCODE level.**
   `fetchRecentTransactions` (L1989) prefers exact-outcode (SW3) matches. So the
   fair-value range (~£1.33–1.56M) reflects genuine prime Chelsea. The median and the
   fair-value range therefore differ because they cover **different geographies**, not
   because one is mis-formatted.
3. **Homepage & /area figures are STATIC editorial content**, not live:
   - `client/src/pages/home.tsx` — two decorative preview cards hardcode `£1.38M`.
   - `client/src/pages/area.tsx` — `AREA_PROFILES` hardcodes `medianPrice: "£1.38M"` etc.
   The static £1.38M is actually **closer to the true SW3 median** than the live £845k.

## Fixes made this pass (safe, no computation redefined)
- **home.tsx** — both preview cards relabelled `Sample Brief · illustrative figures`, so
  the hardcoded £1.38M can't be read as a live figure for a searched postcode.
- **area.tsx** — added an inline note under the Market Snapshot: *"Indicative area guide,
  not a live valuation. Generate a brief for the live HM Land Registry median…"* — so the
  editorial figure can't read as contradicting the live brief (task §2: explain the gap).

## DECISION NEEDED (flagged, not guessed) — what should the live median represent?
The task says: *"Where a genuine calculation choice exists (which figure the median
represents), keep the current intended meaning… if unclear, flag it."* It is unclear, and
resolving it **changes how the raw figure is computed** (which the constraints put
off-limits without a decision). Options:

- **A. Median → outcode-level (match comparables).** Filter `fetchLandRegistryYear` to the
  searched outcode (as `fetchRecentTransactions` already does). Likely makes SW3 read
  ~£1.3M and aligns median with fair-value. Cost: smaller samples in thin-data outcodes →
  must lean harder on the existing confidence gates; and it redefines the median.
- **B. Keep district median but fix the recency cap.** Remove/raise `_pageSize=100&_sort`
  so the median reflects the full district sample, and **label it "district-level median"**
  so it's honestly distinct from the outcode fair-value. Cheapest, but SW3 median stays
  district-wide (still not the outcode figure the user expects).
- **C. Label only (done) + document.** Ship the static-figure labelling above, leave the
  live computation unchanged, and treat A/B as a separate data-methodology task.

## DECISION MADE: Option A — median is now OUTCODE-level (implemented)
`fetchLandRegistryYear(district, outcode, year)` now filters the district result to the
searched outcode via `getOutcode(postcode) === outcode` before computing prices, so the
median / YoY / 5-yr / tier / `demandSignal` / `totalTxns` all describe the searched
outcode and agree with the outcode-level comparables and fair-value at a consistent
granularity. `totalTxns` is now an outcode count, so the existing confidence gates
(`Low` when `totalSalesThisYear < 3`, median needs ≥5) automatically become stricter for
sparse outcodes — the thin-data honesty the task asks for, for free.

Implementation choices:
- **`_pageSize` kept at 100** (known-good). Raising it risks an untested API page-size
  limit on the revenue path. Trade-off: the 100-record district recency cap now also
  bounds the outcode sample, so some legitimately-populated outcodes may trip the
  thin-data path. If verification shows that happening too often, raise `_pageSize`
  toward 500 (API max) — a documented one-line change. This was chosen over a per-year
  district fallback, which would mix granularities across years and corrupt the trend.
- No district fallback for the median: a sparse outcode honestly shows insufficient-data
  rather than silently borrowing the (diluted) district figure.

## MUST verify before merge (no Node/browser here — NOT run)
This is a data-methodology change to the core figure. Generate briefs and check:
- **SW3 1AA (dense):** median now reads ~outcode level (≈£1.3M range), and agrees with
  the fair-value range instead of the old ~£845k district figure.
- **A couple of suburban outcodes:** median still populates and looks sane; YoY/5-yr signs
  correct; no `+-` doubled signs.
- **A rural/thin outcode:** confirm it shows the insufficient-data / low-confidence path
  honestly rather than a shaky number — and that it does NOT over-trigger for outcodes
  that genuinely have sales (if it does, bump `_pageSize`).
- Homepage cards now say "Sample Brief · illustrative figures"; /area shows the indicative
  note — neither reads as contradicting a live brief.
