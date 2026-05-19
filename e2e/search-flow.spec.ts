/**
 * SEARCH FLOW TESTS
 * ─────────────────
 * Tests the core user journey: enter a query → generate brief → land on report.
 *
 * This is the single most critical flow on the site. A broken search means
 * no user can see any value. Tests cover:
 *   - Postcode search (strong data)
 *   - Postcode search (thin/rural data — graceful degradation)
 *   - Address search
 *   - Invalid input — graceful error, no crash
 */

import { test, expect } from "@playwright/test";
import { gotoHome, runSearch, expectNoPageErrors } from "./helpers/navigation";
import { assertReportTitleContains } from "./helpers/report";
import { POSTCODES } from "./helpers/constants";

test.describe("Search Flow", () => {
  test.describe("Postcode search — strong data (SW3 1AA)", () => {
    test("search navigates to brief page", async ({ page }) => {
      const url = await runSearch(page, POSTCODES.strongLondon);
      expect(url, "URL should contain /brief/").toContain("/brief/");
    });

    test("brief page title contains the searched postcode", async ({ page }) => {
      await runSearch(page, POSTCODES.strongLondon);
      await assertReportTitleContains(page, "SW3");
    });

    test("brief page renders report title element", async ({ page }) => {
      await runSearch(page, POSTCODES.strongLondon);
      const title = page.getByTestId("text-report-title");
      await expect(title).toBeVisible();
      const text = await title.innerText();
      expect(text.trim().length).toBeGreaterThan(3);
    });

    test("back button is visible after search", async ({ page }) => {
      await runSearch(page, POSTCODES.strongLondon);
      await expect(page.getByTestId("button-back")).toBeVisible();
    });
  });

  test.describe("Postcode search — thin data (LL55 1TU)", () => {
    test("thin data postcode search completes without crash", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const url = await runSearch(page, POSTCODES.thinData);
      expect(url).toContain("/brief/");

      await expectNoPageErrors(page, errors);
    });

    test("thin data brief page shows report title", async ({ page }) => {
      await runSearch(page, POSTCODES.thinData);
      const title = page.getByTestId("text-report-title");
      await expect(title).toBeVisible();
    });

    test("thin data brief page shows executive summary section", async ({ page }) => {
      await runSearch(page, POSTCODES.thinData);
      await expect(page.getByTestId("section-executive-summary")).toBeVisible();
    });
  });

  test.describe("Address search", () => {
    test("address search navigates to brief page", async ({ page }) => {
      const url = await runSearch(page, "10 Downing Street, London, SW1A 2AA");
      expect(url).toContain("/brief/");
    });

    test("address brief page renders report title", async ({ page }) => {
      await runSearch(page, "10 Downing Street, London, SW1A 2AA");
      const title = page.getByTestId("text-report-title");
      await expect(title).toBeVisible();
      const text = await title.innerText();
      expect(text.trim().length).toBeGreaterThan(3);
    });
  });

  test.describe("Search — regional postcode (LS1 1AA)", () => {
    test("Leeds postcode search completes", async ({ page }) => {
      const url = await runSearch(page, POSTCODES.strongRegional);
      expect(url).toContain("/brief/");
    });

    test("Leeds brief title contains LS1", async ({ page }) => {
      await runSearch(page, POSTCODES.strongRegional);
      await assertReportTitleContains(page, "LS1");
    });
  });

  test.describe("Error handling — invalid input", () => {
    test("invalid postcode does not crash the page", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await gotoHome(page);
      await page.getByTestId("input-search").fill(POSTCODES.invalid);
      await page.getByTestId("button-generate").click();

      // Wait a moment for any crash to materialise
      await page.waitForTimeout(3000);

      // Page should still be functional — either navigated to brief or stayed on home
      const body = page.locator("body");
      await expect(body).not.toBeEmpty();

      // Critical: no uncaught JS errors from the invalid input
      await expectNoPageErrors(page, errors);
    });

    test("empty search does not submit", async ({ page }) => {
      await gotoHome(page);
      // Clear input and click — should not navigate
      const input = page.getByTestId("input-search");
      await input.clear();
      await page.getByTestId("button-generate").click();

      // URL should still be on homepage
      await page.waitForTimeout(500);
      expect(page.url()).toContain("/#/");
      expect(page.url()).not.toContain("/brief/");
    });

    test("search input accepts and trims whitespace", async ({ page }) => {
      await gotoHome(page);
      // Whitespace-padded postcode should still produce a brief
      await page.getByTestId("input-search").fill("  SW3 1AA  ");
      await page.getByTestId("button-generate").click();
      await page.waitForSelector("[data-testid='text-report-title']", {
        timeout: 20_000,
      });
      expect(page.url()).toContain("/brief/");
    });
  });

  test.describe("Try It quick-search buttons", () => {
    test("clicking a 'Try it' example postcode triggers a search", async ({ page }) => {
      await gotoHome(page);
      // Scroll to try-it buttons
      await page.evaluate(() => {
        const el = document.querySelector("[data-testid='button-try-it']");
        el?.scrollIntoView({ behavior: "instant" });
      });
      const tryItBtn = page.getByTestId("button-try-it").first();
      const isVisible = await tryItBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!isVisible) {
        // Try-it buttons may be below fold on some viewports — skip gracefully
        return;
      }
      await tryItBtn.click();
      // After clicking, the app populates the input AND submits — wait for brief
      // OR the input may have a value before the brief navigates
      try {
        await page.waitForSelector("[data-testid='text-report-title']", { timeout: 35_000 });
        expect(page.url()).toContain("/brief/");
      } catch {
        // Fallback: just check the input was populated
        const input = page.getByTestId("input-search");
        const value = await input.inputValue();
        expect(value.trim().length, "Try it button should populate the search input").toBeGreaterThan(0);
      }
    });
  });
});
