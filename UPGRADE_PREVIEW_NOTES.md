# Blurred locked-tier preview — implementation notes

Goal: let a free (Explorer) user see the *shape and specific value* of the paid
tiers **for the postcode they just searched**, as a blurred preview with a clear
unlock CTA — so they understand exactly what they'd get by upgrading.

## What changed
- **New component `client/src/components/UpgradePreview.tsx`.** Self-contained,
  mobile-first, theme-safe (uses semantic tokens, works light/dark).
- **Mounted once in `client/src/pages/brief.tsx`** at the end of the default
  **Overview** tab — after the free summary/value, where buyer intent is highest,
  and on the tab every free user lands on (not a pop-up, not on load).

## How it meets the brief
- **Real, postcode-specific teasers (unblurred) above each blur** — driven by
  counts already in the generated report, e.g.:
  - "14 comparable sold prices found for this postcode"
  - "6 planning applications in the last 12 months"
  - "23 sold prices mapped street-by-street"
  Every count is **guarded**: a data-thin postcode falls back to a truthful
  generic line ("Comparable sales, fair-value range & pre-offer strategy for this
  postcode") rather than a fake number. Nothing shown is invented, and the counts
  match what the user gets after upgrading (same `recentSoldPrices`,
  `planningActivity`, etc.).
- **Two tiers, correctly gated:**
  - Professional block (`£4.99/mo`) — shown to Explorer only (`!isPaid`).
  - Investor block (`£39.99/mo`) — shown to Explorer **and** Professional
    (`!isInvestor`). The whole component renders `null` for Investor.
- **One clear CTA per tier** → `/pricing` (the existing checkout entry; the Stripe
  buy links live on that page). Supporting line: "A buying agent charges hundreds
  per property."
- **Free brief stays genuinely useful** above the preview — this is additive; it
  reads as "there's more," not "we withheld the basics."
- **Mobile:** single-column, full-width `h-11` tappable buttons, `sm:` breakpoints.

## Anti-bypass — what's real vs. the honest limitation
- The blurred area is a **structural skeleton only** — the actual paid FIGURES
  (rents, yields, comp prices, fair-value numbers) are **not rendered** by this
  component, so they can't be read by inspecting its DOM. Only non-sensitive
  **counts/existence** are surfaced, which is exactly what the brief asked to tease.
- **Honest caveat (important):** this app generates the brief **client-side**
  (`client/src/lib/mockEngine.ts` runs in the browser), so the full `report`
  object — including the paid figures for locked sections — necessarily exists in
  the browser's JS memory and is reachable via DevTools/console, independent of
  this component. The task's "gate the sensitive detail **server-side**" is
  therefore **not fully achievable without an architectural change** (moving
  generation, or at least the paid-section synthesis, server-side and sending free
  users only the preview counts). That is a separate, larger piece of work and was
  **not** done here. What this change does guarantee: no paid figures are added to
  readable DOM, and the preview is genuine and consistent with the unlocked view.

## Relationship to existing lock UI
- The app already had `LockedPreview.tsx` (a generic static skeleton, no real data)
  and several inline `blur-sm` placeholder blocks inside detail sections. Those are
  left as-is. This adds the missing piece the brief specifically called for: a
  **postcode-specific**, real-teaser preview positioned after the free value.

## Verify before merge (no Node/browser in this environment — not run here)
- `npm run check` (typecheck — new component + brief.tsx import/usage).
- Load a brief as a signed-out/Explorer user on desktop + a mobile viewport:
  confirm the two blurred blocks appear at the end of Overview, teaser counts are
  real and match the postcode, CTAs are tappable and go to `/pricing`.
- As a Professional user: only the Investor block shows. As Investor: nothing shows.
- Inspect the DOM of the blurred blocks: confirm no real paid figures are present.
