# Progressive brief rendering — approach & notes

## Decision: "safe partial" (perceived progress)
The brief is generated **client-side as one complete object** (`generateBrief` in
`client/src/lib/mockEngine.ts`): it awaits the whole parallel fetch wave, runs a
single ~1,500-line synchronous derivation that computes every section together,
and returns one `BriefReport`. Navigation used to happen only *after* that
completed, so the brief page never mounted until everything was done.

True per-section streaming ("each section appears the moment its own source
resolves") would require splitting that monolithic derivation into independent
per-section resolvers + an incremental data model on the brief page — a
cross-cutting refactor of the revenue-critical generation path with real
content-parity risk, and one that can't be compiled/run/verified in this
environment. Given that, the **safe partial** option was chosen: move the wait
onto the brief page so the skeleton + live status show *during* generation,
without touching how any section is computed.

## What changed (delivery/rendering only — brief content is byte-identical)
- **`client/src/pages/home.tsx`** — on submit, now navigates immediately to
  `/brief?q=<postcode>` instead of running `generateBrief` and only navigating on
  success. All the generation machinery (mutation, elapsed timer, status queue,
  bottom status bar) was removed from home; it now just validates + navigates.
- **`client/src/App.tsx`** — added a `/brief` route (generation mode) alongside the
  existing `/brief/:id` (stored mode). Both point at `BriefPage`.
- **`client/src/pages/brief.tsx`**
  - `BriefPage` now has two modes: **stored** (`/brief/:id`, unchanged — reads the
    in-memory store) and **generation** (`/brief?q=…`, new — runs `generateBrief`
    on the page). Generation runs once (ref-guarded), pushes real progress events
    into a queue, and on success sets the report / on failure shows an error state.
  - `LoadingState` gained optional `statusMessage` + `elapsedSecs` props: in
    generation mode it shows the **real** live pipeline step (paced by a 650 ms
    min-dwell so parallel completions are readable) + elapsed time over the
    existing `SkeletonReport`. In stored mode it falls back to the rotating steps.
  - New `GenerationErrorState` mirrors the typed-error copy the home page used to
    show (NETWORK_ERROR / TIMEOUT_ERROR / generic), with a path back to search.
- **Plan/entitlement:** read from `getUser()` on the brief page — deliberately NOT
  passed in the URL, so the history-depth entitlement can't be tampered via `?plan`.

## How this maps to the definition of done
- Skeleton + live status show **during** the wait, on the page, instead of a blank
  home button. ✅ (mobile: centered status, `SkeletonReport`, no fixed overlay, no
  layout jump)
- A slow/failed source can't hang or block: each source is already bounded by
  `withTimeout`; a hard failure → error state; the status line always keeps moving
  (min-dwell queue, ends on "Building your brief…"). ✅
- Final assembled brief is **identical** — same `generateBrief` call and object. ✅
- Existing generation status line is preserved (relocated to the brief page and
  now driven by real events). ✅

## Honest gap (accepted trade-off of the chosen option)
- **Sections still appear together at completion, not individually as each source
  resolves.** This is the explicit limitation of "safe partial" vs. full streaming.
  Closing it requires the derivation split described above — a separate, larger,
  and (here) unverifiable piece of work. The status line does show real per-source
  progress during the wait, so the user sees genuine motion, just not the brief
  filling in section-by-section.

## Behaviour notes
- Post-generation the URL stays `/brief?q=…` (not swapped to `/brief/:id`). Refresh
  regenerates — which is *better* than before, where `/brief/:id` lost the in-memory
  store on refresh and showed "not found". Portfolio/anon-save use the report
  object, not the URL, so both still work. `/brief/:id` links are unchanged.
- Dev-only: React StrictMode may double-invoke the generation effect (fresh refs on
  remount) → a duplicate generate in dev. Production builds don't double-invoke.

## Verify before merge (no Node/browser here — not run)
- `npm run check` (types: new `/brief` route, brief.tsx generation state, LoadingState props).
- Generate a brief from home on desktop + mobile: confirm it lands on `/brief?q=…`,
  shows skeleton + real live status + elapsed during the wait, then the full brief.
- Kill/slow a source (block overpass-api.de): status keeps moving, brief still completes.
- Force an error (offline): the GenerationErrorState shows with a working back link.
- `/brief/:id` (e.g. a portfolio link) still loads a stored brief unchanged.
