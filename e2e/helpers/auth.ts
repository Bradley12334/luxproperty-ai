/**
 * Auth helpers for the LuxProperty.ai QA suite.
 *
 * LuxProperty.ai manages auth entirely client-side via localStorage (lux_session key).
 * To test plan-gated sections without a live Supabase roundtrip, we inject the
 * session directly into localStorage before the page loads.
 *
 * Pattern:
 *   1. page.goto(url) — load the page
 *   2. setSession(page, testUser) — inject lux_session
 *   3. page.reload() — let the app pick up the session
 *
 * The authStore calls loadSession() synchronously on module load, so the
 * reload is required for the session to take effect.
 */

import type { Page } from "@playwright/test";
import { TEST_USERS, type PlanTier } from "./constants";

type TestUser = (typeof TEST_USERS)[keyof typeof TEST_USERS];

/**
 * Inject a fake session for the given plan tier into localStorage and reload.
 * Call this AFTER the initial navigation so the page origin is set.
 * The cookie banner is dismissed automatically after reload.
 */
export async function setSession(page: Page, plan: PlanTier): Promise<void> {
  const user: TestUser = TEST_USERS[plan];
  await page.evaluate((userData) => {
    localStorage.setItem("lux_session", JSON.stringify(userData));
  }, user);
  await page.reload({ waitUntil: "networkidle" });

  // Dismiss cookie banner after reload if it reappears
  try {
    const banner = page.locator('button:has-text("Accept"), button:has-text("Decline")').first();
    const visible = await banner.isVisible({ timeout: 2_000 }).catch(() => false);
    if (visible) await banner.click();
  } catch {
    // no banner
  }
}

/**
 * Clear any existing session from localStorage and reload.
 */
export async function clearSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("lux_session");
  });
  await page.reload({ waitUntil: "networkidle" });
}

/**
 * Returns the current session object from localStorage, or null if not set.
 */
export async function getSession(page: Page): Promise<TestUser | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("lux_session");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
}
