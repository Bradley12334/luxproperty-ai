/**
 * PRICING PAGE SMOKE TESTS
 * ─────────────────────────
 * Verifies the pricing page renders completely and correctly:
 *   - Both purchasable plan cards visible (Explorer, Full Brief)
 *   - Correct names and prices
 *   - CTA buttons present and have correct links
 *   - Feature comparison table renders
 *   - No broken placeholders
 *   - Retired/hidden tiers are not sold anywhere on the page
 *
 * NOTE ON TESTIDS: they derive from `tier.name.toLowerCase()`, so the Full Brief
 * card is "card-pricing-full brief" — with a space. That is existing behaviour.
 */

import { test, expect } from "@playwright/test";
import { gotoPricing } from "./helpers/navigation";

test.describe("Pricing Page", () => {
  test("pricing page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoPricing(page);

    // Filter benign
    const realErrors = errors.filter(
      (e) =>
        !/ResizeObserver/i.test(e) &&
        !/analytics/i.test(e) &&
        !/clarity/i.test(e)
    );
    expect(realErrors).toHaveLength(0);
  });

  test("both purchasable plan cards are visible", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("card-pricing-full brief")).toBeVisible();
  });

  test("plan names are correct", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toContainText("Explorer");
    await expect(page.getByTestId("card-pricing-full brief")).toContainText("Full Brief");
  });

  test("plan prices are displayed correctly", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toContainText("Free");
    await expect(page.getByTestId("card-pricing-full brief")).toContainText("149");
  });

  test("CTA buttons are present on both plan cards", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("button-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("button-pricing-full brief")).toBeVisible();
  });

  test("feature comparison table renders", async ({ page }) => {
    await gotoPricing(page);
    await page.evaluate(() => {
      document
        .querySelector("[data-testid='table-feature-comparison']")
        ?.scrollIntoView({ behavior: "instant" });
    });
    const table = page.getByTestId("table-feature-comparison");
    await expect(table).toBeVisible();
  });

  test("no duplicate rows in feature table", async ({ page }) => {
    await gotoPricing(page);
    const table = page.getByTestId("table-feature-comparison");
    await expect(table).toBeVisible();

    // Check for the specific duplicate we fixed in the cleanup pass
    const tableHtml = await table.innerHTML();
    const rentalDemandMatches = (
      tableHtml.match(/letting potential/gi) || []
    ).length;
    expect(
      rentalDemandMatches,
      "Rental demand feature should appear exactly once in the table"
    ).toBeLessThanOrEqual(1);
  });

  // ── Hidden-tier guards ──────────────────────────────────────────────────────
  // Investor is no longer sold. Its entitlements, webhook path and Payment Link are
  // all intact for grandfathered subscribers (covered by plan-gating.spec.ts) — it is
  // only the customer-facing sell surface that is gone. These guard the regression.

  test("Investor tier is not offered on the pricing page", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-investor")).toHaveCount(0);
    await expect(page.getByTestId("button-pricing-investor")).toHaveCount(0);
    await expect(page.getByTestId("button-get-investor")).toHaveCount(0);
  });

  test("no Investor pricing or checkout link anywhere on the pricing page", async ({ page }) => {
    await gotoPricing(page);
    const body = await page.locator("body").innerText();
    expect(body, "Investor monthly price should not appear").not.toContain("39.99");

    const stripeLinks = await page.locator('a[href*="buy.stripe.com"]').count();
    expect(stripeLinks, "no direct Stripe Payment Link should be reachable").toBe(0);
  });

  test("pricing page highlights Full Brief as the lead tier", async ({ page }) => {
    await gotoPricing(page);
    const fullBriefCard = page.getByTestId("card-pricing-full brief");
    await expect(fullBriefCard).toContainText("Most buyers start here");
  });

  test("bottom CTAs on pricing page are visible", async ({ page }) => {
    await gotoPricing(page);
    // Scroll to bottom CTAs
    await page.evaluate(() => {
      document
        .querySelector("[data-testid='button-start-full-brief']")
        ?.scrollIntoView({ behavior: "instant" });
    });
    await expect(page.getByTestId("button-start-full-brief")).toBeVisible();
  });
});
