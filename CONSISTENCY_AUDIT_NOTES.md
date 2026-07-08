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

**Recommendation: A**, with the confidence gates doing the thin-data honesty work — it
makes the median mean "this postcode," which is what users read it as, and removes the
median-vs-fair-value geographic mismatch at source. But it's a data-methodology change
that must be measured across dense/suburban/thin postcodes before merge, so it needs your
sign-off rather than a blind edit here (no Node/browser in this environment to verify).

## Not verified here
No Node/browser available, so nothing was run. The homepage/area labels are static JSX
(low risk). The median decision (A/B) is unverified by design — pending your call.
