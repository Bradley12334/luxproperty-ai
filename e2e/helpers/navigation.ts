/**
 * Navigation helpers for the LuxProperty.ai QA suite.
 *
 * LuxProperty.ai uses hash-based routing (wouter useHashLocation).
 * All routes are accessed via /#/<path>.
 *
 * The app is a pure SPA — the server always serves index.html.
 * Report data is held in memory (briefStore) so reports are ephemeral;
 * a fresh page load with a new navigation generates a new brief in memory.
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Navigate to the homepage */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto("/#/");
  await page.waitForSelector("[data-testid='text-hero-heading']", {
    timeout: 15_000,
  });
  await dismissCookieBanner(page);
}

/** Navigate to the pricing page */
export async function gotoPricing(page: Page): Promise<void> {
  await page.goto("/#/pricing");
  await page.waitForSelector("[data-testid='card-pricing-explorer']", {
    timeout: 15_000,
  });
  await dismissCookieBanner(page);
}

/** Navigate to the account page */
export async function gotoAccount(page: Page): Promise<void> {
  await page.goto("/#/account");
  await page.waitForLoadState("networkidle");
  await dismissCookieBanner(page);
}

/**
 * Dismiss the cookie consent banner if it is visible.
 * The banner blocks interaction on first load in a fresh browser context.
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  try {
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Decline")').first();
    const isVisible = await acceptBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (isVisible) {
      await acceptBtn.click();
      // Wait for the banner to disappear
      await page.waitForTimeout(300);
    }
  } catch {
    // Banner not present — that's fine
  }
}

/**
 * Run a postcode/address search from the homepage and wait for the brief
 * page to load. Returns the brief page URL for further assertions.
 *
 * The brief is generated client-side in mockEngine — no network call needed,
 * but we still wait for the report title to render.
 *
 * NOTE: The cookie banner is dismissed automatically before searching.
 */
export async function runSearch(page: Page, query: string): Promise<string> {
  await gotoHome(page);

  // Dismiss cookie banner if present — it can overlay the search input
  await dismissCookieBanner(page);

  const input = page.getByTestId("input-search");
  await input.fill(query);

  // Ensure generate button is enabled before clicking
  const btn = page.getByTestId("button-generate");
  await expect(btn).toBeEnabled({ timeout: 5_000 });
  await btn.click();

  // Wait for the brief page to render the report title.
  // mockEngine calls several external APIs (postcodes.io, Land Registry, EPC, Overpass)
  // which can take 30-60s on cold start. Allow up to 90s.
  await page.waitForSelector("[data-testid='text-report-title']", {
    timeout: 90_000,
  });

  return page.url();
}

/**
 * Navigate directly to a brief page by ID.
 * Useful when you have already generated a brief and stored its ID.
 * NOTE: The brief is ephemeral (in-memory). This only works within the
 * same page/browser context that generated it.
 */
export async function gotoBriefById(page: Page, id: number): Promise<void> {
  await page.goto(`/#/brief/${id}`);
  await page.waitForSelector("[data-testid='text-report-title']", {
    timeout: 20_000,
  });
}

/**
 * Run a search and return the numeric brief ID extracted from the hash URL.
 */
export async function runSearchAndGetId(
  page: Page,
  query: string
): Promise<number> {
  await runSearch(page, query);
  const url = page.url();
  const match = url.match(/#\/brief\/(\d+)/);
  if (!match) throw new Error(`Could not extract brief ID from URL: ${url}`);
  return parseInt(match[1], 10);
}

/**
 * Expect the page to have no uncaught JS errors.
 * Call this AFTER the page has fully settled.
 *
 * We skip known benign errors:
 * - Analytics/tracking noise
 * - ResizeObserver loop errors (Chromium artefact, not real)
 * - Leaflet map initialisation warnings
 */
export async function expectNoPageErrors(
  page: Page,
  collectedErrors: string[]
): Promise<void> {
  const benign = [
    /ResizeObserver loop/i,
    /clarity\.ms/i,
    /google-analytics/i,
    /gtag/i,
    /analytics/i,
    /leaflet/i,
    /favicon/i,
    /non-passive event listener/i,
  ];

  const realErrors = collectedErrors.filter(
    (msg) => !benign.some((pattern) => pattern.test(msg))
  );

  expect(realErrors, "Uncaught page errors detected").toHaveLength(0);
}
