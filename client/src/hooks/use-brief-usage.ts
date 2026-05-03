/**
 * Tracks how many briefs a user has generated this calendar month.
 * Stored in localStorage keyed by "lux_usage_YYYY-MM".
 * Automatically resets each new month.
 * Explorer plan limit: 3 briefs/month.
 */

const EXPLORER_LIMIT = 3;

function storageKey(): string {
  const now = new Date();
  return `lux_usage_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getBriefUsage(): number {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function incrementBriefUsage(): void {
  try {
    const current = getBriefUsage();
    localStorage.setItem(storageKey(), String(current + 1));
  } catch {}
}

export function isAtExplorerLimit(plan: string): boolean {
  if (plan !== "explorer") return false;
  return getBriefUsage() >= EXPLORER_LIMIT;
}

export { EXPLORER_LIMIT };
