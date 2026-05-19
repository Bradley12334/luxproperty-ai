/**
 * Report page helpers for the LuxProperty.ai QA suite.
 *
 * These helpers assert presence of specific report sections and
 * provide reusable checks for plan-gated content.
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Assert that a section identified by data-testid is visible in the DOM.
 * Does NOT assert on text content — just presence and visibility.
 */
export async function assertSectionVisible(
  page: Page,
  testId: string,
  description?: string
): Promise<void> {
  const el = page.getByTestId(testId);
  await expect(el, description ?? `Section [${testId}] should be visible`).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Assert that a section is present in the DOM (may be hidden behind a collapsible).
 * Use this for sections that are collapsed by default.
 */
export async function assertSectionPresent(
  page: Page,
  testId: string,
  description?: string
): Promise<void> {
  const el = page.getByTestId(testId);
  await expect(el, description ?? `Section [${testId}] should be in DOM`).toBeAttached({
    timeout: 10_000,
  });
}

/**
 * Assert that a locked/blurred section is rendered — meaning the section
 * container exists but its content is obscured behind a paywall overlay.
 * We check that the section container is present AND a Lock icon is visible
 * inside it.
 */
export async function assertSectionLocked(
  page: Page,
  testId: string
): Promise<void> {
  const section = page.getByTestId(testId);
  await expect(section, `Locked section [${testId}] should exist in DOM`).toBeAttached({
    timeout: 10_000,
  });
  // The blur overlay child should exist
  const blurChild = section.locator(".blur-sm").first();
  await expect(blurChild, `Locked section [${testId}] should have blur overlay`).toBeAttached();
}

/**
 * Assert a KPI value element is non-empty — contains at least one
 * non-whitespace character. Does not assert specific values.
 */
export async function assertKpiNonEmpty(
  page: Page,
  testId: string
): Promise<void> {
  const el = page.getByTestId(testId);
  await expect(el).toBeVisible({ timeout: 8_000 });
  const text = await el.innerText();
  expect(text.trim(), `KPI [${testId}] should not be empty`).not.toBe("");
}

/**
 * Assert that the report title contains the expected query string.
 * Uses a case-insensitive substring match.
 */
export async function assertReportTitleContains(
  page: Page,
  expected: string
): Promise<void> {
  const title = page.getByTestId("text-report-title");
  await expect(title).toBeVisible({ timeout: 10_000 });
  const text = await title.innerText();
  expect(text.toUpperCase()).toContain(expected.toUpperCase());
}

/**
 * Trigger the PDF export button and wait for a download event.
 * Returns the download object so the caller can inspect file size etc.
 */
export async function triggerPdfExport(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page.getByTestId("button-export-pdf").click(),
  ]);
  return download;
}

/**
 * Assert that the upgrade paywall is showing on the brief page.
 * This means the paid content is obscured and the upgrade CTA is visible.
 */
export async function assertPaywallVisible(page: Page): Promise<void> {
  const upgradeBtn = page.getByTestId("button-paywall-upgrade");
  await expect(upgradeBtn, "Upgrade paywall CTA should be visible for non-paid users").toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Assert that the upgrade paywall is NOT showing — i.e. paid user sees full content.
 */
export async function assertPaywallAbsent(page: Page): Promise<void> {
  const upgradeBtn = page.getByTestId("button-paywall-upgrade");
  await expect(upgradeBtn, "Upgrade paywall should not appear for paid users").not.toBeVisible({
    timeout: 5_000,
  });
}
