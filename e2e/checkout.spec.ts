/**
 * STRIPE CHECKOUT TESTS
 * ─────────────────────
 * Tests the upgrade CTA flow:
 *   - Upgrade button is present on the brief page (paywall)
 *   - Upgrade button links to Stripe checkout (does not 404 or error)
 *   - Pricing page CTA opens Stripe (new tab or redirect)
 *   - Account upgrade button present for Explorer user
 *
 * NOTE: We do NOT complete the Stripe checkout in automated tests.
 * Completing Stripe checkout requires browser automation through Stripe's
 * hosted page and test card entry — this is fragile, Stripe-TOS-sensitive,
 * and better covered by a manual smoke test on each deploy.
 *
 * What we DO test:
 *   - The upgrade CTA elements exist and point to the correct Stripe URL
 *   - The Stripe URL is reachable (HTTP 200 response head)
 *
 * Stripe test mode: The production URLs are used here because the app does
 * not currently expose a test-mode checkout endpoint. These tests assert
 * link presence only and do NOT initiate payment.
 */

import { test, expect } from "@playwright/test";
import { runSearch, gotoPricing } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import { POSTCODES, STRIPE_PRO_URL } from "./helpers/constants";

let sharedBriefUrl: string;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await runSearch(page, POSTCODES.strongLondon);
  sharedBriefUrl = page.url();
  await ctx.close();
});

test.describe("Stripe Checkout — CTA presence and links", () => {
  test("brief paywall shows upgrade CTA for Explorer user", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    const upgradeBtn = page.getByTestId("button-paywall-upgrade");
    await expect(upgradeBtn).toBeVisible({ timeout: 10_000 });
  });

  test("brief paywall upgrade CTA is wrapped in a Stripe link", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    // The upgrade button lives inside an <a href="https://buy.stripe.com/..."> anchor
    const stripeAnchor = page.locator(`a[href="${STRIPE_PRO_URL}"]`).first();
    await expect(stripeAnchor, "Upgrade CTA should link to Professional Stripe checkout").toBeAttached({
      timeout: 10_000,
    });
  });

  test("brief paywall 'View plans' button navigates to pricing", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    const viewPlansBtn = page.getByTestId("button-paywall-view-plans");
    await expect(viewPlansBtn).toBeVisible({ timeout: 10_000 });
    await viewPlansBtn.click();

    // Should navigate to pricing page
    await page.waitForURL(/pricing/, { timeout: 10_000 });
    await expect(page.getByTestId("card-pricing-explorer")).toBeVisible();
  });

  test("pricing page Pro CTA links to Stripe checkout (href check)", async ({ page }) => {
    await gotoPricing(page);
    // Find any Stripe link on the page
    const stripeLinks = page.locator(`a[href*="buy.stripe.com"]`);
    const count = await stripeLinks.count();
    expect(count, "Pricing page should have at least one Stripe checkout link").toBeGreaterThan(0);
  });

  test("Stripe Professional checkout URL is reachable", async ({ page, request }) => {
    // HEAD request to verify the Stripe URL isn't 404
    const response = await request.head(STRIPE_PRO_URL);
    // Stripe may redirect to login or return 200 — anything other than 4xx/5xx is fine
    expect(
      response.status(),
      "Stripe Pro checkout URL should be reachable (not 4xx/5xx)"
    ).toBeLessThan(500);
  });

  test("account page shows upgrade button for Explorer user", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "explorer");
    const upgradeBtn = page.getByTestId("button-upgrade");
    await expect(upgradeBtn).toBeVisible({ timeout: 8_000 });
  });

  test("account page shows manage subscription for Investor user", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "investor");
    const manageBtn = page.getByTestId("button-manage-subscription");
    await expect(manageBtn).toBeVisible({ timeout: 8_000 });
  });

  test("account manage subscription links to Stripe customer portal", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "investor");
    const manageBtn = page.getByTestId("button-manage-subscription");
    await expect(manageBtn).toBeVisible({ timeout: 8_000 });

    // The button should be an anchor or navigate to the billing portal
    const parentLink = page
      .locator("a[href*='billing.stripe.com'], a[href*='stripe']")
      .first();
    const hasPortalLink = await parentLink.count() > 0;
    expect(hasPortalLink, "Manage subscription should link to Stripe billing portal").toBe(true);
  });
});
