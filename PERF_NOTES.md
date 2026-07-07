# Brief generation — performance pass (parallelise data-source calls)

Branch: `perf/parallelise-brief-fetches`. Performance only — **no change to data
sources, architecture, or brief output.** Same brief, generated faster and made
resilient to a slow/hung source.

---

## Step 0 — Measure first (what the bottleneck actually is)

**The brief has no LLM/synthesis step.** `generateBrief` (`client/src/lib/mockEngine.ts`)
is pure data-fetch + deterministic derivation. The derivation is synchronous JS
(string/array work, sub-millisecond). So the entire cost is the network fetches —
the "synthesis dominates" branch is ruled out; parallelising fetches is the right lever.

**The fetches were already partly parallel** — the original premise ("calls run one
at a time") was only half true. The code already used three `Promise.all` **waves**:

| Wave | Contents | Depends on |
|------|----------|-----------|
| 1 | `postcodeMeta`, `district` | the query |
| 2 | Land Registry (N year buckets + recent txns + sold-with-coords) | `district` (wave 1) |
| 3 | 13 live sources (flood, EPC, air, TfL, stations, schools, amenities, crime, planning, rental, broadband, council tax, dwelling mix) | `lat/lng` (wave 1) |

Two real problems remained:

1. **Waves 2 and 3 ran sequentially** — wave 2 was fully `await`ed before wave 3
   started, even though **both depend only on wave 1** (district vs lat/lng — neither
   needs the other). Pure serialisation for no reason.
2. **No timeouts on most sources.** Every fetcher catches its own errors and returns
   `null`/`[]`, so `Promise.all` never *rejects* — but a **hang is unbounded**. Only
   the Overpass fetcher self-aborts (at 12s); postcodes, Land Registry, flood, police
   and the `/api/*` sources have no timeout at all. One hung source stalls the brief.

### Real measured source latencies (best of 3, live endpoints, SW3 / Kensington & Chelsea)

| Source | Cold | Warm | Note |
|--------|------|------|------|
| postcodeMeta / district (wave 1) | ~70ms | ~70ms | fast |
| Land Registry (per parallel call) | ~1.3s | ~0.2s | SPARQL; cold spikes |
| crime (police.uk) | ~180ms | ~180ms | fast |
| flood (Environment Agency) | ~4.2s | ~1.8s | slow, variable |
| **Overpass** (stations/schools/amenities, ×3) | **~8.7s** | ~0.17s | **hit HTTP 429 rate-limit** |

**Overpass is the tail that defines total time**, and it rate-limits. This is the
dominant real-world cost and the reason a single-source stall must be bounded.

---

## Step 1 + 2 — the change

Both in `client/src/lib/mockEngine.ts`:

- **Merged waves 2 + 3 into a single `Promise.all`.** `isLondon` (needed only to gate
  the London-only sources) is now computed from wave-1 metadata *before* the wave, so
  Land Registry and all live sources fire together. Total fetch time is now
  `wave1 + max(all sources)` instead of `wave1 + LR + liveSources`.
- **Added `withTimeout(p, ms, fallback, label)`** wrapping every source. It resolves the
  section's existing `null`/`[]` fallback if the source neither resolves nor rejects
  within `SOURCE_TIMEOUT_MS`, and also converts a rejection to that fallback. This gives
  `Promise.allSettled` semantics (one bad source can't reject the group) **plus** a hard
  time bound (one hung source can't delay the group) in one wrapper — output values are
  identical to before for every source that succeeds in time.
- **`SOURCE_TIMEOUT_MS = 9000`** — a *hang-ceiling*, not an aggressive cut. It sits above
  the legitimately-slow sources (cold Overpass ~8s, flood ~4s) so it does **not** drop
  sections that would have succeeded, while bounding the un-timed sources' worst case.
  Tunable: lower toward 6s to prioritise speed over completeness; raise toward 12s for
  the reverse. Documented inline at the constant.
- **Instrumentation:** set `window.__LUX_PERF = true` in the browser console before
  generating a brief to log each source's wall time + the total. Off by default.

Genuine dependency preserved: wave 1 (postcode → coords/district) still runs first;
only the two truly-independent downstream groups were merged.

---

## Step 3 — modelled before/after (using the code's exact wave arithmetic)

Applying the real measured latencies above to the old vs new control flow:

| Scenario | OLD `w1 + LR + live` | NEW `w1 + max(LR, live)` capped @9s | Change |
|----------|----------------------|-------------------------------------|--------|
| Cold (typical London) | 0.07 + 1.5 + 8.7 ≈ **10.3s** | 0.07 + 8.7 ≈ **8.8s** | −1.5s (merge) |
| Overpass 429 / hung source | 1.5 + up to 12s (or ∞ on an un-timed source) ≈ **13.6s+** | 0.07 + 9 ≈ **9.1s** | bounded, no hang |
| Warm caches | 0.07 + 0.2 + 4.2 ≈ **4.5s** | 0.07 + 4.2 ≈ **4.3s** | −0.2s (merge) |

**Honest read:** because the previous author had already parallelised within each wave,
this pass does not produce a uniform 2× everywhere. The guaranteed win is removing the
wave-2→wave-3 serialisation (saves the whole Land Registry group off the critical path,
~0.2–1.5s). The larger win is **resilience**: the pathological tail (Overpass
rate-limiting, or any un-timed source hanging) goes from *13.6s → indefinite* down to a
bounded ~9s. The hard floor is Overpass itself (~8s cold), which cannot be reduced
without caching or querying it differently — see follow-ups.

### Verification status — IMPORTANT

These figures are modelled from **real endpoint probes + the code's wave arithmetic**.
They were **not** produced by running the app, because this working environment has no
Node runtime / `node_modules` (no `tsc`, no dev server, no browser). Before merging:

1. `npm run check` — confirm the refactor typechecks (it mirrors the original
   expressions, but has not been compiler-verified here).
2. Run the app, set `window.__LUX_PERF = true`, and generate briefs for **SW3 1AA**
   (dense London), a couple of suburban postcodes, and a rural/thin-data one. Capture the
   `[perf]` console breakdown and confirm the totals and that no section regressed.
3. Force a stall (e.g. block `overpass-api.de`) and confirm the brief still completes
   ~9s with the affected sections omitted — never a hang or hard failure.

---

## Follow-ups (out of scope here — would change fetch logic/architecture)

- **Overpass is the floor (~8s cold, rate-limited) and is queried 3× separately**
  (stations, schools, amenities). Combining them into one Overpass query, or caching by
  rounded lat/lng, would cut the dominant cost — but that changes the fetch logic, so it
  is deliberately left for a separate, reviewable change.
- Consider `AbortController` inside each fetcher so a timed-out request is actually
  cancelled (today `withTimeout` stops *waiting* but the request finishes in the
  background). Correctness is unaffected; it only saves a wasted connection.
