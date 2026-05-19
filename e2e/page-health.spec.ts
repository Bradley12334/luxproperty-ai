/**
 * PAGE HEALTH CHECKS
 * ──────────────────
 * Verifies that all core pages load without crashes, show their primary
 * headings, and don't throw uncaught JS errors.
 *
 * These are the fastest, most valuable tests: a broken homepage or
 * pricing page is immediately visible to every user.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, gotoPricing, gotoAccount, expectNoPageErrors } from "./helpers/navigation";
import { setSession } from "./helpers/auth";

test.describe("Page Health", () => {
  test("homepage loads and shows hero heading", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoHome(page);

    const heading = page.getByTestId("text-hero-heading");
    await expect(heading).toBeVisible();
    const text = await heading.innerText();
    expect(text.trim().length, "Hero heading should have content").toBeGreaterThan(5);

    await expectNoPageErrors(page, errors);
  });

  test("homepage shows search input and generate button", async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByTestId("input-search")).toBeVisible();
    await expect(page.getByTestId("button-generate")).toBeVisible();
  });

  test("homepage shows all three pricing tier cards", async ({ page }) => {
    await gotoHome(page);
    // Scroll to the pricing section
    await page.evaluate(() => {
      const el = document.querySelector("[data-testid='card-pricing-explorer']");
      el?.scrollIntoView({ behavior: "instant" });
    });
    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("card-pricing-professional")).toBeVisible();
    await expect(page.getByTestId("card-pricing-investor")).toBeVisible();
  });

  test("pricing page loads and shows plan cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoPricing(page);

    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
    await expect(page.getByTestId("card-pricing-professional")).toBeVisible();
    await expect(page.getByTestId("card-pricing-investor")).toBeVisible();

    await expectNoPageErrors(page, errors);
  });

  test("pricing page shows correct plan names and prices", async ({ page }) => {
    await gotoPricing(page);

    const explorerCard = page.getByTestId("card-pricing-explorer");
    await expect(explorerCard).toContainText("Explorer");
    await expect(explorerCard).toContainText("Free");

    const proCard = page.getByTestId("card-pricing-professional");
    await expect(proCard).toContainText("Professional");
    await expect(proCard).toContainText("4.99");

    const investorCard = page.getByTestId("card-pricing-investor");
    await expect(investorCard).toContainText("Investor");
    await expect(investorCard).toContainText("39.99");
  });

  test("pricing page shows feature comparison table", async ({ page }) => {
    await gotoPricing(page);
    await page.evaluate(() => {
      document.querySelector("[data-testid='table-feature-comparison']")
        ?.scrollIntoView({ behavior: "instant" });
    });
    await expect(page.getByTestId("table-feature-comparison")).toBeVisible();
  });

  test("account page loads (no auth)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await gotoAccount(page);

    // Without auth, the page should show sign-in prompt or account shell — not crash
    // The page should render something (not a blank white page)
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();

    await expectNoPageErrors(page, errors);
  });

  test("account page with Pro session shows correct plan info", async ({ page }) => {
    await gotoAccount(page);
    await setSession(page, "professional");

    await expect(page.locator("body")).toContainText("Professional");
  });

  test("about page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/#/about");
    await page.waitForLoadState("networkidle");

    // Page should not be blank
    await expect(page.locator("body")).not.toBeEmpty();
    await expectNoPageErrors(page, errors);
  });

  test("404 page renders for unknown route", async ({ page }) => {
    await page.goto("/#/this-route-does-not-exist-qa");
    await page.waitForLoadState("networkidle");
    // Should render something, not be blank
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
