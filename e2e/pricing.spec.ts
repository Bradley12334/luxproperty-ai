/**
 * PRICING PAGE SMOKE TESTS
 * ─────────────────────────
 * Verifies the pricing page renders completely and correctly:
 *   - All three plan cards visible
 *   - Correct names and prices
 *   - CTA buttons present and have correct links
 *   - Feature comparison table renders
 *   - No broken placeholders
 *   - Investor wording audit: no over-inflated enterprise copy
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

  test("all three plan cards are visible", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("card-pricing-professional")).toBeVisible();
    await expect(page.getByTestId("card-pricing-investor")).toBeVisible();
  });

  test("plan names are correct", async ({ page }) => {
    await gotoPricing(page);
    const explorer = page.getByTestId("card-pricing-explorer");
    const pro = page.getByTestId("card-pricing-professional");
    const investor = page.getByTestId("card-pricing-investor");

    await expect(explorer).toContainText("Explorer");
    await expect(pro).toContainText("Professional");
    await expect(investor).toContainText("Investor");
  });

  test("plan prices are displayed correctly", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("card-pricing-explorer")).toContainText("Free");
    await expect(page.getByTestId("card-pricing-professional")).toContainText("4.99");
    await expect(page.getByTestId("card-pricing-investor")).toContainText("39.99");
  });

  test("CTA buttons are present on all plan cards", async ({ page }) => {
    await gotoPricing(page);
    await expect(page.getByTestId("button-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("button-pricing-professional")).toBeVisible();
    await expect(page.getByTestId("button-pricing-investor")).toBeVisible();
  });

  test("Professional CTA links to Stripe checkout (opens new tab)", async ({ page, context }) => {
    await gotoPricing(page);
    const proBtn = page.getByTestId("button-pricing-professional");
    await expect(proBtn).toBeVisible();

    // The CTA uses window.open() — wait for a new page (tab) to open
    const [newPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 10_000 }),
      proBtn.click(),
    ]);

    const newUrl = newPage.url();
    expect(
      newUrl.includes("stripe") || newUrl.includes("buy.stripe"),
      `Pro CTA should open Stripe checkout, got: ${newUrl}`
    ).toBeTruthy();

    await newPage.close();
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

  test("Investor card does not use inflated enterprise language", async ({ page }) => {
    await gotoPricing(page);
    const investorCard = page.getByTestId("card-pricing-investor");
    const text = await investorCard.innerText();

    // These phrases were flagged in the audit as over-inflated enterprise-only language
    const overblownPhrases = [
      "enterprise",
      "dedicated account manager",
      "custom pricing",
      "priority support",
    ];
    for (const phrase of overblownPhrases) {
      expect(
        text.toLowerCase(),
        `Investor card should not contain over-inflated phrase: "${phrase}"`
      ).not.toContain(phrase.toLowerCase());
    }
  });

  test("pricing page shows professional as 'Recommended' tier", async ({ page }) => {
    await gotoPricing(page);
    const proCard = page.getByTestId("card-pricing-professional");
    // The Professional card should have a "Recommended" badge
    await expect(proCard).toContainText("Recommended");
  });

  test("bottom CTAs on pricing page are visible", async ({ page }) => {
    await gotoPricing(page);
    // Scroll to bottom CTAs
    await page.evaluate(() => {
      document
        .querySelector("[data-testid='button-start-professional']")
        ?.scrollIntoView({ behavior: "instant" });
    });
    await expect(page.getByTestId("button-start-professional")).toBeVisible();
  });
});
