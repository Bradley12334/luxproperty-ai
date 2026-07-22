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
