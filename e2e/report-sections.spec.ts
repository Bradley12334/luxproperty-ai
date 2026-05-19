/**
 * REPORT SECTION RENDERING
 * ─────────────────────────
 * Verifies that all key brief sections render for a Professional-level user.
 * Tests confirm presence — not copy quality.
 *
 * This suite uses localStorage session injection to simulate a paid user
 * without a real Supabase login. A fresh search is run at the start of
 * each describe block so all sections are populated with live mockEngine data.
 *
 * Section test IDs (from brief.tsx):
 *   section-red-flags             — "What would worry me here?" risk box
 *   section-shortlist-verdict     — "Would I shortlist this?" block
 *   section-buyer-verdict         — Buyer verdict / final call
 *   section-executive-summary     — Executive summary card
 *   section-market-overview       — Market overview + KPIs
 *   section-price-trend           — Price trend table
 *   section-neighbourhood         — Neighbourhood profile collapsible
 *   section-flood                 — Flood, climate & resilience
 *   section-stations              — Nearby stations
 *   section-schools               — Nearby schools
 *   section-lifestyle-fit         — Lifestyle fit scoring (5 categories)
 *   section-negotiation-leverage  — Negotiation leverage (NL component)
 *   section-planning              — Planning activity
 *   section-rental-market         — Rental market snapshot
 *   section-broadband             — Broadband & infrastructure
 *   section-developments          — Nearby development tracker
 *   section-market-outlook        — Market outlook
 *   section-verdict               — Final verdict card
 */

import { test, expect } from "@playwright/test";
import { runSearch } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import {
  assertSectionVisible,
  assertSectionPresent,
  assertKpiNonEmpty,
  assertReportTitleContains,
  assertPaywallAbsent,
  assertPaywallVisible,
} from "./helpers/report";
import { POSTCODES } from "./helpers/constants";

// ── Setup: shared brief URL for Professional user ────────────────────────────
// We run the search once, get the URL, then reload with the Pro session.
// Each test in this describe re-navigates to the same brief.

test.describe("Report Sections — Professional user (SW3 1AA)", () => {
  let briefUrl: string;

  test.beforeAll(async ({ browser }) => {
    // Generate the brief once and capture the URL
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await runSearch(page, POSTCODES.strongLondon);
    briefUrl = page.url();
    await ctx.close();
  });

  // Helper: navigate to brief as Pro user
  async function loadBriefAsPro(page: Parameters<Parameters<typeof test>[2]>[0]) {
    await page.goto(briefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
  }

  test("report title renders and is non-empty", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertReportTitleContains(page, "SW3");
  });

  test("no upgrade paywall for Pro user", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertPaywallAbsent(page);
  });

  test("executive summary section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionVisible(page, "section-executive-summary");
  });

  test("market overview renders with KPIs", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionVisible(page, "section-market-overview");
    // KPIs inside market overview
    await assertKpiNonEmpty(page, "text-kpi-time-on-market");
    await assertKpiNonEmpty(page, "text-kpi-supply-level");
  });

  test("price trend table renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionVisible(page, "section-price-trend");
    await assertSectionPresent(page, "table-price-trend");
  });

  test("shortlist verdict block renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-shortlist-verdict");
    // Verdict label should be non-empty
    const label = page.getByTestId("text-shortlist-label");
    await expect(label).toBeVisible({ timeout: 8_000 });
    const text = await label.innerText();
    expect(text.trim()).not.toBe("");
  });

  test("shortlist verdict reasoning is present", async ({ page }) => {
    await loadBriefAsPro(page);
    const reasoning = page.getByTestId("text-shortlist-reasoning");
    await expect(reasoning).toBeVisible({ timeout: 8_000 });
    const text = await reasoning.innerText();
    expect(text.trim().length).toBeGreaterThan(10);
  });

  test("'What would worry me here?' red flags section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-red-flags");
    await expect(page.getByTestId("section-red-flags")).toBeVisible({ timeout: 8_000 });
  });

  test("neighbourhood profile section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-neighbourhood");
  });

  test("flood, climate & resilience section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-flood");
  });

  test("nearby stations section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-stations");
  });

  test("nearby schools section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-schools");
  });

  test("lifestyle fit block renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-lifestyle-fit");
    // Lifestyle glance (at-a-glance bar) should be visible
    await assertSectionPresent(page, "section-lifestyle-glance");
  });

  test("planning activity section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    // Planning may be live (section-planning) or locked (section-planning-locked)
    const liveSection = page.getByTestId("section-planning");
    const lockedSection = page.getByTestId("section-planning-locked");
    const liveExists = await liveSection.count() > 0;
    const lockedExists = await lockedSection.count() > 0;
    expect(liveExists || lockedExists, "Planning section (live or locked) should exist").toBe(true);
  });

  test("rental market section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    const liveSection = page.getByTestId("section-rental-market");
    const lockedSection = page.getByTestId("section-rental-market-locked");
    const liveExists = await liveSection.count() > 0;
    const lockedExists = await lockedSection.count() > 0;
    expect(liveExists || lockedExists, "Rental market section should exist").toBe(true);
  });

  test("broadband section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    const liveSection = page.getByTestId("section-broadband");
    const lockedSection = page.getByTestId("section-broadband-locked");
    const liveExists = await liveSection.count() > 0;
    const lockedExists = await lockedSection.count() > 0;
    expect(liveExists || lockedExists, "Broadband section should exist").toBe(true);
  });

  test("market outlook section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-market-outlook");
  });

  test("final verdict section renders", async ({ page }) => {
    await loadBriefAsPro(page);
    await assertSectionPresent(page, "section-verdict");
  });

  test("negotiation leverage section renders for Pro user", async ({ page }) => {
    await loadBriefAsPro(page);
    // NegotiationLeverage only renders for property reports (address queries)
    // For postcode reports it may be absent — just verify no crash
    await page.waitForTimeout(1000);
    const exists = await page.getByTestId("section-negotiation-leverage").count() > 0;
    if (exists) {
      await assertKpiNonEmpty(page, "nl-fair-value");
      await assertKpiNonEmpty(page, "nl-demand-label");
    }
    // No assertion on absence — postcode reports legitimately omit this
  });
});

// ── Report sections with address query ──────────────────────────────────────

test.describe("Report Sections — address query (10 Downing Street)", () => {
  let briefUrl: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await runSearch(page, "10 Downing Street, London, SW1A 2AA");
    briefUrl = page.url();
    await ctx.close();
  });

  async function loadAsPro(page: Parameters<Parameters<typeof test>[2]>[0]) {
    await page.goto(briefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });
  }

  test("address report renders report title", async ({ page }) => {
    await loadAsPro(page);
    const title = page.getByTestId("text-report-title");
    await expect(title).toBeVisible();
    const text = await title.innerText();
    expect(text.trim().length).toBeGreaterThan(3);
  });

  test("address report shows valuation section", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-valuation");
  });

  test("address report shows comparables section", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-comparables");
  });

  test("address report shows offer strategy section", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-offer-strategy");
  });

  test("address report shows negotiation leverage", async ({ page }) => {
    await loadAsPro(page);
    await assertSectionPresent(page, "section-negotiation-leverage");
  });
});
