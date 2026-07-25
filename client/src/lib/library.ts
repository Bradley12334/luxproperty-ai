// ─── My Briefs library (client) ──────────────────────────────────────────────
// Fetches the signed-in account's owned Full Briefs from GET /api/my-briefs, using
// the verified session token (authHeader). brief_purchases is service-role-only, so
// this must go through the server — the browser cannot read ownership directly.
//
// Anonymous / error → an empty list (never throws): "My briefs" is simply empty for a
// logged-out visitor, and a transient failure shows an empty library, not a crash.
import { authHeader, getToken } from "./authStore";

export interface OwnedBrief {
  /** Postcode district, e.g. "E8". The owned brief opens at /brief/<outcode>. */
  outcode: string;
  /** ISO timestamp the Full Brief was purchased. */
  grantedAt: string;
}

export async function fetchMyBriefs(): Promise<OwnedBrief[]> {
  if (!getToken()) return [];
  try {
    const res = await fetch("/api/my-briefs", { headers: authHeader() });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const briefs = Array.isArray((data as { briefs?: unknown }).briefs)
      ? ((data as { briefs: unknown[] }).briefs as Array<Record<string, unknown>>)
      : [];
    return briefs
      .map((b) => ({ outcode: String(b.outcode || "").toUpperCase(), grantedAt: String(b.grantedAt || "") }))
      .filter((b) => b.outcode.length > 0);
  } catch {
    return [];
  }
}
