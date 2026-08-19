# LuxProperty AI — Brief Pipeline Specification
This is the build contract for the postcode brief rebuild. Paste at the top of every Claude Code session. All work must conform to it.

## Scope boundary (standing rule, every session)
Only brief-pipeline files may be modified. NEVER modify: homepage, about, pricing page, guides pages, auth, Stripe/payment code, or any shared component/module used outside the brief. The brief may CALL shared code (db client, layout wrapper, plan lookup) but never MODIFY it. If a change appears to require touching a shared file, STOP and report — do not proceed.

## Data spine
- Postcode in → Postcodes.io lookup → lat/lng, district, ward, local authority.
- VALIDATION GUARD: reverse-geocode the resolved coordinates; returned district MUST equal requested district, else fail loudly with a clear error. Never generate from an unverified location.
- One transaction set: Land Registry filtered `postcode LIKE 'DISTRICT %'` (trailing space — N1 must not match N10–N19), deduplicated on transaction ID.
- EVERY price statistic (median, YoY, 10-year trend, price/m², fair value, opening range) derives from this single set via one stats module. No section runs its own divergent price query.
- Scottish/NI postcodes rejected cleanly: "England & Wales only." Invalid postcodes error clearly.
- SOURCE: the offline PPD aggregate (`brief_tx_agg_district` / `brief_tx_agg_sector`), gated per district by `TX_SOURCE` + `TX_AGG_DISTRICTS`, falling back to the live Land Registry SPARQL scan. Both sources normalise to one Spine object (`lib/brief/tx-source.js`) and run through one derivation (`deriveStats` in `lib/brief/stats.js`), so the two paths cannot diverge in presentation.
- FRESHNESS IS PART OF THE CONTRACT. Every price figure is dated from `source_published` whether or not it is stale. A missing or unparseable date is a REFUSAL, not an assumption of freshness. Past 60 days the aggregate is refused outright. The serving window comes from `window_start`/`window_end` on the row, never computed from the clock.
- WRONG-LEVEL RULE: wherever the brief tells a reader that a figure is the wrong level for their address (e.g. the sector-divergence warn band), NO valuation or offer range anchored to that figure may be shown alongside it. Facts stay (district median, sector median, counts, the sales); claims derived from the wrong anchor are withheld, and the copy states that the omission is deliberate.

### Sector grain — one rule, and the end state we are not at
The brief reports at **district grain** and says so. Where the resolved postcode's sector diverges from its district by more than the sector's own 90% sampling error (and has >= 30 sales), the brief:
- states that sector's median as a figure in its own right, with its sale count and range;
- says plainly that the figures below describe the district, not the address;
- withholds any fair-value or opening-offer range, because those are anchored to a district median now known to be the wrong level for this address (the WRONG-LEVEL RULE above).

There is deliberately **no third "serve the sector" band**. One shipped briefly and was removed: it told the reader "figures are for postcode sector CR0 2" while every figure downstream remained district-derived — on CR0 2AB, a district median of £352,500 over 16,713 district sales, and a negotiation range ~15% above the sector's own level. Nothing had ever been implemented to swap the figures; the copy was the whole feature.

**Sector-grain serving (B) is the REMEDY for the withholding, not a nice-to-have.** The one rule above withholds a negotiation range from **6,596 sectors — 79.4% of all sectors** — and for most of them the withholding is a statement about our data, not about the evidence. CR0 2 has **2,454 recorded sales**: that is more than enough to anchor a fair-value range on, comfortably past the 300-sale valuation floor the district rule uses. We withhold anyway, because a range anchored to the *district* median would be ~14% wrong for that address and we have no *sector*-anchored range to offer instead.

That is a data gap with a known fix, not a limitation of the method. The sector aggregate already carries everything `statsFromAggregate` consumes (`txCount/median/ciLo/ciHi/p25/p75/min/max/byYear`), so sector-anchored medians, trends and valuation ranges are computable today. What is missing is sector-grain `streets[]`, `recent[]` sales and `byType` — without them a "sector brief" would put a sector median beside a district street ranking, district comparables and a district type split, mixing grains inside one section and making `street-ranking`'s vs-area baseline a meaningless ratio.

Closing it requires the offline aggregation (`~/Documents/ppd-agg/aggregate.mjs`) to emit streets and recent sales at sector grain, and every section to state which grain it covers. That is a data-model change plus a design change — but it is scoped, and until it lands the correct reading of a withheld range is "we cannot yet anchor this to your sector", not "your sector cannot be valued".

### What the aggregate validation does and does NOT cover
The offline aggregate was validated against all 1,906 cached SPARQL payloads by HM Land Registry transaction GUID (`~/Documents/ppd-agg/validate.mjs`). **This is district-grain verification only.** Do not read it later as full verification of the aggregate:
- **Verified**: district transaction counts, window median and CI, the byYear series, street groupings and medians, the recent-sale set by transaction id, and the trailing-3-year count. All divergence traced to Land Registry deletions and amendments between snapshots; worst district median moved 1.12%.
- **NOT verified against any baseline**: every sector median, count and CI, and the serve/warn/none divergence classification. The SPARQL spine had no sector concept, so no baseline exists by construction. The sector grain is instead checked by independent recomputation from the raw CSVs down a separate code path (`~/Documents/ppd-agg/verify-sectors.mjs`), plus reconciliation of sector counts to district counts.
- **NOT verifiable at all** from the frozen corpus: `paon`, `saon`, `town`, `propertyType` and `tenure` on recent sales. The cache dump projected those fields away, so no comparison is possible — they rest on the parser mirroring `lib/brief/transactions.js`, not on measurement.

## Section render states (every section, no exceptions)
- DATA: full section with real figures + source footnote.
- SPARSE: renders what exists + honest caveat (e.g. "low transaction volume — yearly medians based on few sales"); missing cells show "—", never fabricated.
- UNAVAILABLE: explicit "data unavailable for this postcode" message.
Sections NEVER silently disappear. Every failure path renders a fallback or logs loudly.

## Confidence
Computed from real transaction counts and dataset coverage. Never hardcoded, never asserted.

## Verdict guardrail
Verdict derives only from section outputs. If geocode validation failed, comps are out-of-district, or key datasets are empty for a dense urban area: hedged verdict + "data incomplete" — never a confident negative from missing data.

## Tier gating (must match the pricing page — this table IS the pricing page, transcribed)
Tiers: Explorer (free) / Professional (£4.99/mo) / Investor (£39.99/mo). Cumulative access.
- SERVER-SIDE ONLY: the brief payload is built containing only sections/depth the user's plan is entitled to. Gated content is never sent to the client and hidden with CSS/JS.
- Locked sections render as titled upgrade previews (title + one-line description + upgrade CTA), never as gaps.
- PDF export is itself a PRO+ entitlement, and the exported PDF is generated from the same tier-filtered payload.
- One entitlement config (feature key → minimum tier + quota) covering sections, depth variants, AND non-section entitlements. Pricing page, brief, and PDF must all agree with it.
- Plan read from the Stripe-linked account at generation time; upgrades apply at next generation.

### Non-section entitlements
| Entitlement | EXP | PRO | INV |
|---|---|---|---|
| Briefs per month | 3 | Unlimited | Unlimited |
| Export to PDF (client-ready) | — | ✓ | ✓ |
| Save & revisit briefs | — | ✓ | ✓ |
| Portfolio dashboard (save/compare multiple briefs) | — | — | ✓ |
| Custom report branding (name/firm on PDFs) | — | — | ✓ |
Quota enforced server-side at generation time (count per calendar month per account).

### Sections & depth by tier
EXPLORER (free):
- Area screening verdict — Good fit / Mixed / Limited fit
- Executive summary
- Market overview (average price, YoY change)
- Price trend: 1-YEAR only
- Neighbourhood profile (schools, transport, safety, walkability summary)
- Named schools, stations, parks & amenities
- Flood & climate risk (full section)
- Council tax band
- Simple commute note (single headline destination)

PROFESSIONAL adds:
- Price trend: 5-YEAR history
- Property type split (ONLY if wired to real ONS data — never placeholder; if removed from the brief, the pricing page must be updated to match)
- Full commute calculator — times to multiple destinations
- Crime breakdown by category (police.uk)
- Comparable sales & valuation range (in-district, deduped; "not a formal valuation" note retained)
- Pre-offer strategy — fair value range, opening range, seller pressure points
- Pre-offer questions — what to ask before committing
- Planning activity & risk flags
- Broadband speed & fibre coverage (Ofcom)
- Rental market context — rents & demand
- Air quality index (monitor location named)

INVESTOR adds:
- Price trend: 10-YEAR history (cross-area comparison framing)
- Rental demand score — letting potential rated across areas
- Sold prices map — visual layout of recent transactions nearby (coordinates are postcode-centroid estimates; label as such)
- Street price ranking — relative pricing within the area (derived from the spine transaction set)
- Development tracker — pipeline and local change signals

### Depth-variant rule
Where a feature is tiered by depth (price trend 1yr/5yr/10yr; commute note vs full calculator), the server computes only the entitled depth. A PRO payload contains 5 years of trend data, not 10 years with 5 hidden.

## Section rules (key ones)
- Sold prices: in-district only, deduped; <3 comps → explicit message, no out-of-district backfill.
- Trend table: always renders for entitled tiers; sparse years show "—" + low-volume note.
- Flood: EA lookup at validated coordinates, never borough-level; watercourses sanity-checked against location.
- Council tax: statutory multipliers (A=6/9 … D=1 … H=2×D); bands above D always cost MORE than D.
- Stations/commute: distance from validated coordinates; no station in range → say so; commute destinations adapt to region (no Canary Wharf for Cornwall).
- Schools: specialist schools identified as such; "no current Ofsted rating" explained; catchment caveat always shown.
- Rental/ONS benchmarks labelled with their true geographic granularity.
- Resident sentiment: grammatical, non-duplicated; no curated content → "no curated resident data", never stitched fragments.
- Formatting: correct signs (-5.1% / +5.1%), deduped line names, no placeholder data labelled as a real source.
- Positioning: due-diligence tool, NOT a valuation tool. "Not a formal valuation" notes retained.

## Process rules
One module per prompt. Commit after every working stage. Build on the rebuild branch, preview deploys only — nothing merges to main until the full brief passes Phase 4 checks. Every session ends with a generated brief that has been reviewed.
