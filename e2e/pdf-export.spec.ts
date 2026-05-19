/**
 * PDF EXPORT TESTS
 * ─────────────────
 * Verifies the PDF export feature:
 *   - Export button present for paid users
 *   - Export button absent (locked) for Explorer users
 *   - Clicking export triggers a file download
 *   - Downloaded file is non-zero size
 *   - PDF filename is set (not "download" or blank)
 *
 * The PDF is generated client-side by the exportToPDF function in brief.tsx
 * using jsPDF. It does not make a server request — it creates a Blob and
 * triggers a browser download. Playwright's download event captures this.
 *
 * NOTE: PDF content inspection (verifying section text inside the PDF) is
 * not performed — that requires a PDF parsing library and the content is
 * validated by the report section tests instead.
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import { runSearch } from "./helpers/navigation";
import { setSession } from "./helpers/auth";
import { POSTCODES } from "./helpers/constants";

let sharedBriefUrl: string;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await runSearch(page, POSTCODES.strongLondon);
  sharedBriefUrl = page.url();
  await ctx.close();
});

test.describe("PDF Export", () => {
  test("PDF export button is visible for Professional user", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    // Scroll to action bar
    await page.evaluate(() => {
      document
        .querySelector("[data-testid='button-export-pdf']")
        ?.scrollIntoView({ behavior: "instant" });
    });

    const exportBtn = page.getByTestId("button-export-pdf");
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });
  });

  test("PDF export button is visible for Investor user", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "investor");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    const exportBtn = page.getByTestId("button-export-pdf");
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });
  });

  test("PDF export button shows locked state for Explorer user", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "explorer");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    // Explorer sees the locked PDF button, not the active one
    const lockedBtn = page.getByTestId("button-export-pdf-locked");
    const activeBtn = page.getByTestId("button-export-pdf");

    // Locked should be visible
    await expect(lockedBtn).toBeVisible({ timeout: 8_000 });

    // The fully-functional export button should NOT be visible for Explorer
    const activeVisible = await activeBtn.isVisible().catch(() => false);
    expect(activeVisible, "Active PDF export should not be visible for Explorer").toBe(false);
  });

  test("clicking PDF export triggers a download for Pro user", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    // Scroll export button into view
    await page.evaluate(() => {
      document
        .querySelector("[data-testid='button-export-pdf']")
        ?.scrollIntoView({ behavior: "instant" });
    });

    const exportBtn = page.getByTestId("button-export-pdf");
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 25_000 }),
      exportBtn.click(),
    ]);

    // File should have a name
    const filename = download.suggestedFilename();
    expect(filename, "PDF download should have a filename").not.toBe("");
    expect(filename.toLowerCase(), "Downloaded file should be a PDF").toContain(".pdf");

    // Save and verify file size
    const savePath = path.join("/tmp", filename);
    await download.saveAs(savePath);
    const size = (await import("fs")).statSync(savePath).size;
    expect(size, "PDF file should not be empty").toBeGreaterThan(0);
  });

  test("PDF export with custom branding field still downloads", async ({ page }) => {
    await page.goto(sharedBriefUrl);
    await setSession(page, "professional");
    await page.waitForSelector("[data-testid='text-report-title']", {
      timeout: 20_000,
    });

    // Fill optional company name field if present
    const companyInput = page.getByTestId("input-company-name");
    if (await companyInput.isVisible()) {
      await companyInput.fill("QA Test Ltd");
    }

    const exportBtn = page.getByTestId("button-export-pdf");
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 25_000 }),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toContain(".pdf");
  });
});
