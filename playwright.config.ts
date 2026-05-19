import { defineConfig, devices } from "@playwright/test";

/**
 * LuxProperty.ai — Playwright QA Configuration
 *
 * Targets the live site at https://luxproperty.ai by default.
 * Set BASE_URL env var to test a different environment (e.g. a Vercel preview URL).
 *
 * Usage:
 *   npm run qa:sweep           — headless, all tests
 *   npm run qa:sweep:headed    — headed (watch mode)
 *   npm run qa:sweep:ui        — Playwright UI explorer
 *   npx playwright test --grep "search"  — filter by test name
 */

const BASE_URL = process.env.BASE_URL ?? "https://luxproperty.ai";
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  /* Timeout per test — generous for live network + cold-start API calls.
   * The brief generator calls postcodes.io, Land Registry, EPC, Overpass, and others.
   * Allow 120s per test to accommodate slow API responses. */
  timeout: 120_000,

  /* Retries: 2 in CI (flap guard), 0 locally for fast feedback */
  retries: IS_CI ? 2 : 0,

  /* Parallel workers — 1 in CI to avoid session conflicts, 2 locally */
  workers: IS_CI ? 1 : 2,

  /* Reporter */
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ...(IS_CI ? [["github"] as ["github"]] : []),
  ],

  /* Global settings inherited by all projects */
  use: {
    baseURL: BASE_URL,

    /* Hash-routing: navigate via full URL to avoid router quirks */
    navigationTimeout: 30_000,

    /* Capture on failure */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    /* ── Desktop Chrome ─────────────────────────────────────────── */
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },

    /* ── Mobile (iPhone 12) ─────────────────────────────────────── */
    {
      name: "mobile",
      use: {
        ...devices["iPhone 12"],
        viewport: { width: 375, height: 812 },
      },
      /* Only run responsive-layout and critical smoke tests on mobile */
      testMatch: [
        "**/page-health.spec.ts",
        "**/responsive.spec.ts",
        "**/search-flow.spec.ts",
      ],
    },
  ],

  /* Output folder for screenshots / videos */
  outputDir: "test-results",
});
