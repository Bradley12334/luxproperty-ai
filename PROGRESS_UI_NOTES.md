# Live generation progress — implementation notes

Goal: make the brief-generation wait feel intentional by showing, at the bottom of
the screen, what is actually being fetched — driven by **real** pipeline events, not
a fake timed animation. Same brief, better wait. No change to brief content or the
generation pipeline's data/output.

## What changed

### 1. Pipeline emits real progress (`client/src/lib/mockEngine.ts`)
- `generateBrief(query, plan, onProgress?)` gained an optional third arg — a sink
  called with a short human message as each real step **settles**.
- Each data source is already wrapped in `withTimeout(p, ms, fallback, label)`.
  `withTimeout` now calls a module-level `_progressReporter(label)` inside its
  `done()` — i.e. the message fires exactly when that source resolves, errors, OR
  times out. So the line is **driven by genuine state**, and can never stick on a
  slow/failed source: `withTimeout` guarantees every label settles within
  `SOURCE_TIMEOUT_MS` (9s) and reports once.
- `SOURCE_PROGRESS_MSG` maps each `label` → a calm, source-named message
  (HM Land Registry, Environment Agency, Ofsted, police.uk, Ofcom, …). Several
  Land Registry labels map to the same "sold prices" message on purpose.
- Messages are **de-duplicated** (`emitProgress` + a `Set`) so each distinct
  message shows at most once, in real completion order.
- A final `emitProgress("Building your brief…")` fires after the fetch wave, before
  the synchronous derivation/assembly.
- The reporter is set at the top of the call and cleared in a new `finally`
  (single-flight: the Generate button is disabled while pending, so a module-level
  reporter is safe and avoids threading a callback through ~16 call sites).

### 2. UI status bar (`client/src/pages/home.tsx`)
- A **fixed bottom bar** (`fixed inset-x-0 bottom-0`, `z-50`, safe-area padding)
  shown only while generating — visible without scrolling, which matters on mobile
  where the Generate button sits mid-page.
- Shows: pulsing dots · the current real step · elapsed time (`3.2s`) · an
  expectation line ("Checking a dozen official UK sources … Usually 5–15 seconds").
- **Pacing:** real events land in `progressQueueRef`; a 120ms interval advances the
  displayed message only after `MIN_DWELL_MS` (650ms), so the burst of near-
  simultaneous parallel completions is readable instead of a flicker. Order shown =
  real completion order.
- Seeded with "Connecting to official data sources…" so the bar is never blank
  before the first event.
- Other callers (`portfolio.tsx`, `compare.tsx`) pass no `onProgress` — unaffected.

## Robustness / definition-of-done mapping
- **Live, updating status at the bottom** → fixed bar, real per-source events. ✅
- **Real steps, not filler** → messages keyed off the actual `withTimeout` labels. ✅
- **Expectation line (approx time + source count)** → in the bar, real values. ✅
- **Mobile** → fixed bottom, single-line truncation, safe-area inset. ✅
- **Failed/slow source doesn't freeze or block** → `withTimeout` settles every
  source ≤9s and reports on error/timeout too; line always advances and ends on
  "Building your brief…". ✅

## Not done (deliberate follow-up)
- **Section-by-section render as data arrives (task #4):** bigger change — the brief
  is assembled in one pass after the wave and stored, then the page reads it. Would
  require streaming partial `BriefReport` state into the brief page. Left as a
  follow-up per the task's "treat as follow-up" allowance.

## Verify before merge (could not run here — no Node in this environment)
- `npm run check` (typecheck — `onProgress` optional arg + home.tsx hooks).
- Load the app, generate SW3 1AA on desktop + mobile viewport: confirm the bar is
  visible without scrolling, messages advance and read in a sensible order, elapsed
  ticks, and it ends on "Building your brief…" then navigates.
- Force a slow source (throttle network / block overpass-api.de) and confirm the
  line keeps moving and the brief still completes.
- `window.__LUX_PERF = true` to cross-check that message order tracks real
  per-source settle times in the console.
