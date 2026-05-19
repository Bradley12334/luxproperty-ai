/**
 * CONSOLE & NETWORK SANITY
 * ─────────────────────────
 * Monitors the most critical flows for:
 *   - Uncaught JavaScript errors on page load and after search
 *   - Server-side 500 errors on core API routes
 *   - Critical 404s on non-optional assets
 *   - No repeated or cascading error patterns
 *
 * We deliberately do NOT fail on:
 *   - ResizeObserver loop errors (Chromium internal artefact)
 *   - Third-party analytics errors (Clarity, GA, Plausible)
 *   - Leaflet map initialisation warnings
 *   - Non-critical asset 404s (fonts on CDN, favicons)
 *   - CORS warnings from external APIs (Overpass, EPC — handled client-side)
 */

import { test, expect } from "@playwright/test";
import { gotoHome, gotoPricing, runSearch } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import { POSTCODES } from "./helpers/constants";

// Errors / warnings we consider benign and should NOT fail tests
const BENIGN_PATTERNS = [
  /ResizeObserver loop/i,
  /clarity\.ms/i,
  /google-analytics/i,
  /googletagmanager/i,
  /gtag/i,
  /plausible/i,
  /analytics/i,
  /favicon/i,
  /non-passive event listener/i,
  /leaflet/i,
  /overpass-api/i,           // Overpass API CORS is intentional (client-side only)
  /epc\.opendatacommunities/i, // EPC API CORS
  /walk-score/i,
  /walkscore/i,
  /fonts\.googleapis/i,       // CDN font 4xx is not critical
  /fontshare/i,
  /Failed to load resource.*favicon/i,
];

function isBenign(msg: string): boolean {
  return BENIGN_PATTERNS.some((p) => p.test(msg));
}

// ── Homepage console health ──────────────────────────────────────────────────

test.describe("Console Health — Homepage", () => {
  test("no uncaught errors on homepage load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await gotoHome(page);
    await page.waitForTimeout(2000); // Let async effects settle

    expect(errors, "Uncaught JS errors on homepage").toHaveLength(0);
  });

  test("no critical console errors on homepage", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !isBenign(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    await gotoHome(page);
    await page.waitForTimeout(2000);

    // Allow 0 real errors
    expect(consoleErrors, "Console errors on homepage").toHaveLength(0);
  });
});

// ── Search flow console health ────────────────────────────────────────────────

test.describe("Console Health — Search Flow", () => {
  test("no uncaught errors during postcode search flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await runSearch(page, POSTCODES.strongLondon);
    await page.waitForTimeout(2000);

    expect(errors, "Uncaught JS errors during search flow").toHaveLength(0);
  });

  test("no uncaught errors during thin-data postcode search", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await runSearch(page, POSTCODES.thinData);
    await page.waitForTimeout(2000);

    expect(errors, "Uncaught JS errors during thin-data search").toHaveLength(0);
  });

  test("no uncaught errors when loading paid report as Pro user", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await runSearch(page, POSTCODES.strongLondon);
    await setSession(page, "professional");
    await page.waitForTimeout(3000); // Let the full report settle

    expect(errors, "Uncaught JS errors on Pro report page").toHaveLength(0);
  });

  test("no uncaught errors when loading paid report as Investor user", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await runSearch(page, POSTCODES.strongRegional);
    await setSession(page, "investor");
    await page.waitForTimeout(3000);

    expect(errors, "Uncaught JS errors on Investor report page").toHaveLength(0);
  });
});

// ── Network / HTTP health ─────────────────────────────────────────────────────

test.describe("Network Health", () => {
  test("no 500 errors on homepage load", async ({ page }) => {
    const serverErrors: { url: string; status: number }[] = [];

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      // Only care about our own domain (or relative URLs)
      if (
        status >= 500 &&
        (url.includes("luxproperty.ai") || url.startsWith("/"))
      ) {
        serverErrors.push({ url, status });
      }
    });

    await gotoHome(page);
    await page.waitForTimeout(2000);

    expect(
      serverErrors,
      "No 500 errors should occur on homepage load"
    ).toHaveLength(0);
  });

  test("no 500 errors on pricing page load", async ({ page }) => {
    const serverErrors: { url: string; status: number }[] = [];

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      if (
        status >= 500 &&
        (url.includes("luxproperty.ai") || url.startsWith("/"))
      ) {
        serverErrors.push({ url, status });
      }
    });

    await gotoPricing(page);
    await page.waitForTimeout(2000);

    expect(
      serverErrors,
      "No 500 errors should occur on pricing page load"
    ).toHaveLength(0);
  });

  test("main application JavaScript bundle loads (no 404)", async ({ page }) => {
    const failedAssets: string[] = [];

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      // Critical: JS bundles must not 404
      if (status === 404 && /\.js$/.test(url) && url.includes("luxproperty.ai")) {
        failedAssets.push(url);
      }
    });

    await gotoHome(page);
    await page.waitForTimeout(1000);

    expect(
      failedAssets,
      "Application JS bundles should all load successfully"
    ).toHaveLength(0);
  });

  test("main CSS bundle loads (no 404)", async ({ page }) => {
    const failedAssets: string[] = [];

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      if (status === 404 && /\.css$/.test(url) && url.includes("luxproperty.ai")) {
        failedAssets.push(url);
      }
    });

    await gotoHome(page);
    await page.waitForTimeout(1000);

    expect(
      failedAssets,
      "Application CSS bundles should all load successfully"
    ).toHaveLength(0);
  });
});

// ── Pricing page console health ───────────────────────────────────────────────

test.describe("Console Health — Pricing", () => {
  test("no uncaught errors on pricing page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!isBenign(err.message)) errors.push(err.message);
    });

    await gotoPricing(page);
    await page.waitForTimeout(1500);

    expect(errors, "Uncaught JS errors on pricing page").toHaveLength(0);
  });
});
