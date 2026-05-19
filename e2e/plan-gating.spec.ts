/**
 * PLAN GATING TESTS
 * ─────────────────
 * Verifies that:
 *   - Explorer users see locked sections and the upgrade paywall
 *   - Professional users see Pro sections unlocked, Investor sections still locked
 *   - Investor users see all sections unlocked
 *
 * Auth is injected via localStorage. The plan field on the lux_session object
 * drives all gating on the brief page. No real Supabase call is made.
 *
 * Locked section pattern in the app:
 *   - data-testid="section-<name>-locked" wraps the blurred preview
 *   - A `.blur-sm` div sits inside the locked container
 *   - The upgrade paywall (data-testid="button-paywall-upgrade") appears
 *     for sections gated behind Professional plan
 *
 * Explorer-visible sections (free):
 *   section-executive-summary, section-market-overview, section-price-trend,
 *   section-neighbourhood, section-flood, section-stations, section-schools,
 *   section-lifestyle-glance, section-lifestyle-fit, section-council-tax,
 *   section-explorer-verdict
 *
 * Pro-gated sections (blur-locked for Explorer):
 *   section-planning-locked, section-rental-market-locked,
 *   section-broadband-locked, section-air-quality-locked,
 *   section-verdict (paywall wall)
 *
 * Investor-only sections:
 *   section-rental-demand-locked, section-developments-locked,
 *   section-sold-prices-locked (for Investor only)
 */

import { test, expect } from "@playwright/test";
import { runSearch } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import {
  assertSectionVisible,
  assertSectionPresent,
  assertSectionLocked,
  assertPaywallVisible,
  assertPaywallAbsent,
} from "./helpers/report";
import { POSTCODES } from "./helpers/constants";

// Generate one brief URL shared across all gating tests
let sharedBriefUrl: string;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await runSearch(page, POSTCODES.strongLondon);
  sharedBriefUrl = page.url();
  await ctx.close();
});

// ── Explorer (free) plan ──────────────────────────────────────────────────────

test.describe("Plan Gating — Explorer (free)", () => {
  async function loadAsExplorer(page: Parameters<Parameters<typeof test>[2]>[0]) {
    await page.goto(sharedBriefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
  }

  test("Explorer sees executive summary", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionVisible(page, "section-executive-summary");
  });

  test("Explorer sees market overview", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionVisible(page, "section-market-overview");
  });

  test("Explorer sees price trend section", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionVisible(page, "section-price-trend");
  });

  test("Explorer sees explorer verdict", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionPresent(page, "section-explorer-verdict");
  });

  test("Explorer sees upgrade paywall", async ({ page }) => {
    await loadAsExplorer(page);
    await assertPaywallVisible(page);
  });

  test("Explorer upgrade CTA links to Professional checkout", async ({ page }) => {
    await loadAsExplorer(page);
    const upgradeBtn = page.getByTestId("button-paywall-upgrade");
    await expect(upgradeBtn).toBeVisible();
    // The button should be wrapped in or navigate to the Stripe checkout
    // It's an <a> tag wrapping the button — check the parent link
    const link = page.locator("a[href*='buy.stripe.com'], a[href*='stripe']").first();
    await expect(link).toBeAttached();
  });

  test("Explorer sees locked planning section", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionLocked(page, "section-planning-locked");
  });

  test("Explorer sees locked rental market section", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionLocked(page, "section-rental-market-locked");
  });

  test("Explorer sees locked broadband section", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionLocked(page, "section-broadband-locked");
  });

  test("Explorer sees locked air quality section", async ({ page }) => {
    await loadAsExplorer(page);
    await assertSectionLocked(page, "section-air-quality-locked");
  });

  test("no session (logged out) also shows paywall", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    // Navigate without setting any session
    await page.evaluate(() => localStorage.removeItem("lux_session"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
    await assertPaywallVisible(page);
  });
});

// ── Professional plan ─────────────────────────────────────────────────────────

test.describe("Plan Gating — Professional", () => {
  async function loadAsPro(page: Parameters<Parameters<typeof test>[2]>[0]) {
    await page.goto(sharedBriefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
  }

  test("Professional has no upgrade paywall", async ({ page }) => {
    await loadAsPro(page);
    await assertPaywallAbsent(page);
  });

  test("Professional sees market outlook section", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-market-outlook");
  });

  test("Professional sees final verdict section", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-verdict");
  });

  test("Professional sees planning section (not locked)", async ({ page }) => {
    await loadAsPro(page);
    // For Pro, the live planning section should exist (not the locked version)
    const liveSection = page.getByTestId("section-planning");
    const lockedSection = page.getByTestId("section-planning-locked");
    // At least one should exist; if live exists, locked should not have blur overlay accessible
    const liveExists = await liveSection.count() > 0;
    expect(liveExists, "Pro user should see live planning section").toBe(true);
    // Locked version should NOT be present for Pro
    const lockedCount = await lockedSection.count();
    expect(lockedCount, "Locked planning section should not appear for Pro").toBe(0);
  });

  test("Professional sees rental market section (not locked)", async ({ page }) => {
    await loadAsPro(page);
    const liveSection = page.getByTestId("section-rental-market");
    const liveExists = await liveSection.count() > 0;
    expect(liveExists, "Pro user should see live rental market section").toBe(true);
    const lockedCount = await page.getByTestId("section-rental-market-locked").count();
    expect(lockedCount, "Locked rental market should not appear for Pro").toBe(0);
  });

  test("Professional still sees Investor-only sections as locked", async ({ page }) => {
    await loadAsPro(page);
    // Investor-only sections should still be locked for Pro
    // Check at least one investor-only locked section is present
    const rentalDemandLocked = await page.getByTestId("section-rental-demand-locked").count();
    const developmentsLocked = await page.getByTestId("section-developments-locked").count();
    // At least one investor-only lock should exist for Pro user
    const anyInvestorLocked = rentalDemandLocked > 0 || developmentsLocked > 0;
    expect(anyInvestorLocked, "At least one Investor-only section should remain locked for Pro").toBe(true);
  });

  test("Professional account page shows Professional plan label", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "professional");
    await expect(page.locator("body")).toContainText("Professional");
  });
});

// ── Investor plan ─────────────────────────────────────────────────────────────

test.describe("Plan Gating — Investor", () => {
  async function loadAsInvestor(page: Parameters<Parameters<typeof test>[2]>[0]) {
    await page.goto(sharedBriefUrl);
    await setSession(page, "investor");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
  }

  test("Investor has no upgrade paywall", async ({ page }) => {
    await loadAsInvestor(page);
    await assertPaywallAbsent(page);
  });

  test("Investor sees market outlook section", async ({ page }) => {
    await loadAsInvestor(page);
    await assertSectionPresent(page, "section-market-outlook");
  });

  test("Investor sees rental demand section (not locked)", async ({ page }) => {
    await loadAsInvestor(page);
    // For Investor, the live rental demand section exists
    const liveSection = page.getByTestId("section-rental-demand");
    const liveExists = await liveSection.count() > 0;
    expect(liveExists, "Investor should see rental demand section unlocked").toBe(true);
    const lockedCount = await page.getByTestId("section-rental-demand-locked").count();
    expect(lockedCount, "Rental demand locked section should not appear for Investor").toBe(0);
  });

  test("Investor sees development tracker section (not locked)", async ({ page }) => {
    await loadAsInvestor(page);
    const liveSection = page.getByTestId("section-developments");
    const liveExists = await liveSection.count() > 0;
    expect(liveExists, "Investor should see development tracker unlocked").toBe(true);
    const lockedCount = await page.getByTestId("section-developments-locked").count();
    expect(lockedCount, "Development tracker locked should not appear for Investor").toBe(0);
  });

  test("Investor account page shows Investor plan label", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "investor");
    await expect(page.locator("body")).toContainText("Investor");
  });

  test("Investor account page shows manage subscription button", async ({ page }) => {
    await page.goto("/#/account");
    await setSession(page, "investor");
    const manageBtn = page.getByTestId("button-manage-subscription");
    await expect(manageBtn).toBeVisible({ timeout: 8_000 });
  });
});
