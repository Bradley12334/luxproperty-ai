# LuxProperty.ai — Playwright QA Suite

Pre-launch automated QA sweep covering page health, search flows, report section rendering, plan gating, Stripe checkout links, PDF export, responsive layout, and console/network sanity.

---

## Running the Suite

### Prerequisites

```bash
# Install dependencies (already done if you ran npm install)
npm install

# Browsers are installed at setup — Chromium only
npx playwright install chromium
```

### Commands

| Command | What it does |
|---|---|
| `npm run qa:sweep` | Full suite, headless, desktop + mobile |
| `npm run qa:sweep:headed` | Full suite with browser visible |
| `npm run qa:sweep:ui` | Playwright UI explorer (pick tests, step through) |
| `npm run qa:sweep:desktop` | Desktop only |
| `npm run qa:sweep:mobile` | Mobile (375px) only |
| `npm run qa:sweep:ci` | CI mode — retries on fail, GitHub reporter |
| `npm run qa:report` | Open last HTML report |

### Run a single test file

```bash
npx playwright test e2e/page-health.spec.ts
```

### Filter by test name

```bash
npx playwright test --grep "search"
npx playwright test --grep "gating.*Explorer"
```

### Point at a different environment

```bash
BASE_URL=https://deploy-preview-42.vercel.app npm run qa:sweep
```

The suite defaults to `https://luxproperty.ai`. Set `BASE_URL` to target any preview URL.

---

## Test Coverage Summary

| File | Area | Tests |
|---|---|---|
| `page-health.spec.ts` | All core pages load, headings render, no crashes | ~10 |
| `search-flow.spec.ts` | Search → brief navigation, error handling | ~12 |
| `report-sections.spec.ts` | All key report sections render for Pro user | ~22 |
| `plan-gating.spec.ts` | Explorer/Pro/Investor lock/unlock logic | ~22 |
| `pricing.spec.ts` | Pricing page smoke, correct prices, no duplicates | ~10 |
| `checkout.spec.ts` | Upgrade CTAs present and linked to Stripe | ~8 |
| `pdf-export.spec.ts` | PDF button visibility, download triggers, file size | ~5 |
| `responsive.spec.ts` | Homepage/Pricing/Brief at 375px and 1280px | ~16 |
| `console-network.spec.ts` | No JS errors on critical flows, no 500s | ~12 |

---

## Test Postcodes Used

| Postcode | Type | Purpose |
|---|---|---|
| `SW3 1AA` | Strong data — Chelsea, London | Primary test postcode. Full Land Registry volume, curated enrichment, all sections render. |
| `LS1 1AA` | Strong data — Leeds city centre | Tests the non-London regional data path. |
| `LL55 1TU` | Thin data — Caernarfon, rural Wales | Verifies graceful degradation. Should not crash or show empty UI errors. |
| `INVALID1` | Deliberately invalid | Tests error handling. Must not crash the page. |
| `10 Downing Street, London, SW1A 2AA` | Address query | Tests the address search path and address-only report sections (valuation, offer strategy, negotiation leverage). |

---

## Test Users (Injected via localStorage)

Auth is injected directly into `localStorage` under the `lux_session` key — no real Supabase call is made. The `plan` field drives all gating logic on the brief page.

| User | Plan | ID |
|---|---|---|
| QA Explorer | `explorer` | `qa-explorer-001` |
| QA Professional | `professional` | `qa-pro-001` |
| QA Investor | `investor` | `qa-investor-001` |

These are synthetic — they do not correspond to real Supabase rows. Plan gating is fully client-side, so injection is sufficient.

---

## Environment Variables

| Variable | Default | Usage |
|---|---|---|
| `BASE_URL` | `https://luxproperty.ai` | Target environment |
| `CI` | unset | Set to `1` or `true` in CI; enables retries and GitHub reporter |

No Stripe keys, Supabase keys, or credentials are needed to run the suite.

---

## What Still Needs Manual QA

These areas are not covered by automated tests — they require human judgement or live account actions:

### Report Quality
- **Copy quality**: Are the verdict labels sensible for each postcode? Does the confidence level match the evidence quality?
- **Thin-data graceful degradation**: Does `LL55 1TU` look professional when data is sparse, or are sections obviously missing/hollow?
- **Shortlist verdict accuracy**: Does "Probably not worth pursuing" vs "Strong shortlist" feel appropriately calibrated across a range of postcodes?
- **Resident sentiment bullets**: Do they read naturally and add real signal?

### Stripe / Payments (end-to-end)
- **Complete a test payment**: Use a Stripe test card (`4242 4242 4242 4242`) on a staging/test environment to verify the full checkout → webhook → plan upgrade flow.
- **Plan upgrade in-session**: After a successful payment, does the brief page immediately reflect the new plan (no stale session)?
- **Webhook delivery**: Verify the Stripe webhook (`/api/stripe-webhook`) is receiving events and updating the Supabase `users.plan` field correctly.
- **Customer portal**: Does the "Manage subscription" link correctly show the user's existing subscription in the Stripe portal?

### Premium Feel / Trust
- **Does the site feel like a premium buyer tool?** — Subjective assessment on mobile especially.
- **Dark mode consistency**: Does the report look polished in dark mode across all sections?
- **Loading states**: Does the brief loading state (skeleton or spinner) look professional?
- **PDF output quality**: Open the generated PDF and check it looks like a credible buyer brief (formatting, no truncated text, correct fonts).

### Edge Cases
- **Very long street names**: Do they wrap correctly in the report title?
- **Postcodes with special characters**: e.g. outer London postcodes with unusual outcode formats.
- **Session expiry**: If the Supabase session expires mid-session, is the UX recovery graceful?
- **Concurrent brief generation**: Opening multiple tabs and generating briefs simultaneously — do the brief IDs stay isolated?

---

## Assumptions

1. **No real Supabase users needed**: All plan-gating tests use localStorage injection. The auth tests use synthetic user objects.
2. **Brief data is client-side only**: `generateBrief()` runs in the browser (mockEngine.ts). No backend call. Reports are ephemeral per session.
3. **`beforeAll` brief generation**: Tests that need a pre-generated brief URL use `test.beforeAll` to generate it once per describe block. If Playwright parallelises across workers, each worker gets its own browser context and generates its own brief.
4. **PDF download path**: `/tmp/` is used to save PDFs during tests. On CI, verify the temp directory is writable.
5. **Stripe URL reachability**: The checkout URL health check makes a `HEAD` request. Stripe may redirect (302/303) before returning 200 — the test accepts any status < 500.
6. **Mobile tests**: The `mobile` project in `playwright.config.ts` only runs `page-health`, `responsive`, and `search-flow` specs. Full gating/PDF tests run desktop only.

---

## Debugging Failures

```bash
# Run with traces on always (not just first retry)
npx playwright test --trace=on

# Open trace viewer
npx playwright show-trace test-results/<test-name>/trace.zip

# Screenshot on every test (heavy, use sparingly)
npx playwright test --screenshot=on
```

Test artifacts (screenshots, videos, traces) land in `test-results/`. HTML report in `playwright-report/`.
