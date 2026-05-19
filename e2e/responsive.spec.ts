/**
 * RESPONSIVE LAYOUT TESTS
 * ───────────────────────
 * Verifies that key pages render correctly at desktop (1280px) and mobile (375px).
 *
 * These tests run on the `mobile` Playwright project which is configured with
 * a 375px viewport, so most assertions apply at that size when this file runs
 * on mobile. The desktop project also picks up this file for desktop assertions.
 *
 * Checks:
 *   - Primary headings visible
 *   - No severe horizontal overflow (content doesn't spill off-screen)
 *   - Primary CTAs visible and reachable on mobile
 *   - Navigation reachable on mobile
 *   - Report sections don't overflow at 375px
 *
 * We do NOT assert pixel-perfect layout — that requires visual regression
 * testing (Applitools, Percy, etc.), which is manual QA scope.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, gotoPricing, runSearch } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import { POSTCODES } from "./helpers/constants";

// ── Homepage responsive ──────────────────────────────────────────────────────

test.describe("Responsive — Homepage", () => {
  test("homepage hero heading is visible", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByTestId("text-hero-heading")).toBeVisible();
  });

  test("search input is visible and interactable", async ({ page }) => {
    await gotoHome(page);
    const input = page.getByTestId("input-search");
    await expect(input).toBeVisible();
    await input.fill("SW3");
    const value = await input.inputValue();
    expect(value).toBe("SW3");
  });

  test("generate button is visible above the fold or reachable", async ({ page }) => {
    await gotoHome(page);
    const btn = page.getByTestId("button-generate");
    await expect(btn).toBeVisible();
  });

  test("no horizontal overflow on homepage", async ({ page }) => {
    await gotoHome(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    // Allow a 2px tolerance for sub-pixel rendering
    expect(
      scrollWidth - clientWidth,
      "Homepage should not have horizontal overflow"
    ).toBeLessThanOrEqual(2);
  });

  test("homepage navigation bar renders", async ({ page }) => {
    await gotoHome(page);
    // Header should be visible
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });
});

// ── Pricing page responsive ───────────────────────────────────────────────────

test.describe("Responsive — Pricing", () => {
  test("pricing page renders all three plan cards", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("card-pricing-professional")).toBeVisible();
    await expect(page.getByTestId("card-pricing-investor")).toBeVisible();
  });

  test("no horizontal overflow on pricing page", async ({ page }) => {
    await gotoPricing(page);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(
      scrollWidth - clientWidth,
      "Pricing page should not have horizontal overflow"
    ).toBeLessThanOrEqual(2);
  });

  test("Professional CTA button is reachable on pricing page", async ({ page }) => {
    await gotoPricing(page);
    const proBtn = page.getByTestId("button-pricing-professional");
    await expect(proBtn).toBeVisible();
    // Check it's within the viewport or scrollable to
    const box = await proBtn.boundingBox();
    expect(box, "Pro CTA should have a bounding box (be renderable)").toBeTruthy();
  });
});

// ── Report / Brief page responsive ───────────────────────────────────────────

test.describe("Responsive — Report Page", () => {
  let briefUrl: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await runSearch(page, POSTCODES.strongLondon);
    briefUrl = page.url();
    await ctx.close();
  });

  test("report title renders on brief page", async ({ page }) => {
    await page.goto(briefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("text-report-title")).toBeVisible();
  });

  test("back button is accessible on brief page", async ({ page }) => {
    await page.goto(briefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("button-back")).toBeVisible();
  });

  test("executive summary card renders on brief page", async ({ page }) => {
    await page.goto(briefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("section-executive-summary")).toBeVisible();
  });

  test("no horizontal overflow on brief page", async ({ page }) => {
    await page.goto(briefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(
      scrollWidth - clientWidth,
      "Brief page should not have horizontal overflow"
    ).toBeLessThanOrEqual(2);
  });

  test("market overview KPIs render without clipping", async ({ page }) => {
    await page.goto(briefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    const kpi = page.getByTestId("text-kpi-time-on-market");
    await expect(kpi).toBeVisible();
    const box = await kpi.boundingBox();
    expect(box, "Time on market KPI should be renderable").toBeTruthy();
    // Height should be non-zero (not clipped to 0)
    expect(box!.height, "KPI should not be clipped to zero height").toBeGreaterThan(0);
  });
});

// ── Account page responsive ───────────────────────────────────────────────────

test.describe("Responsive — Account Page", () => {
  test("account page renders without overflow", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "professional");
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth - clientWidth).toBeLessThanOrEqual(2);
  });

  test("sign out button accessible on account page", async ({ page }) => {
    await page.goto("/#/account");
    await page.waitForLoadState("networkidle");
    await setSession(page, "professional");

    const signOutBtn = page.getByTestId("button-account-sign-out");
    await expect(signOutBtn).toBeVisible({ timeout: 10_000 });
  });
});
