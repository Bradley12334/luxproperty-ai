// ─── My Briefs library (client) ──────────────────────────────────────────────
// Fetches the signed-in account's library from GET /api/my-briefs, using the verified
// session token (authHeader). Two kinds:
//   • owned   — paid Full Briefs (brief_purchases), "revisit free, forever".
//   • carried — a brief generated while anonymous, carried over at sign-up (a bookmark,
//               NOT ownership — regenerating it still gates by plan).
// Both tables are service-role-only, so this must go through the server; the browser
// cannot read them directly.
//
// Anonymous / error → empty lists (never throws): the library is simply empty for a
// logged-out visitor, and a transient failure shows empty, not a crash.
import { authHeader, getToken } from "./authStore";

export interface OwnedBrief {
  /** Postcode district, e.g. "E8" — the entitlement key. */
  outcode: string;
  /** The buyer's originally-typed FULL postcode, e.g. "SW1A 1AA", or null for a
   *  bare-outcode purchase / pre-migration row. The library links to /brief/<postcode>
   *  when present (the point brief), falling back to /brief/<outcode> (the district). */
  postcode: string | null;
  /** ISO timestamp the Full Brief was purchased. */
  grantedAt: string;
}

export interface CarriedBrief {
  /** Postcode district, e.g. "E8". */
  outcode: string;
  /** The postcode the visitor generated while anonymous (links to its brief). */
  postcode: string | null;
  /** ISO timestamp the brief was carried into the account. */
  createdAt: string;
}

export interface MyBriefs {
  owned: OwnedBrief[];
  carried: CarriedBrief[];
}

export async function fetchMyBriefs(): Promise<MyBriefs> {
  if (!getToken()) return { owned: [], carried: [] };
  try {
    const res = await fetch("/api/my-briefs", { headers: authHeader() });
    if (!res.ok) return { owned: [], carried: [] };
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    const rawOwned = Array.isArray((data as { briefs?: unknown }).briefs)
      ? ((data as { briefs: unknown[] }).briefs as Array<Record<string, unknown>>)
      : [];
    const owned: OwnedBrief[] = rawOwned
      .map((b) => {
        const rawPc = typeof b.postcode === "string" ? b.postcode.trim() : "";
        return {
          outcode: String(b.outcode || "").toUpperCase(),
          postcode: rawPc ? rawPc.toUpperCase() : null,
          grantedAt: String(b.grantedAt || ""),
        };
      })
      .filter((b) => b.outcode.length > 0);

    const rawCarried = Array.isArray((data as { carried?: unknown }).carried)
      ? ((data as { carried: unknown[] }).carried as Array<Record<string, unknown>>)
      : [];
    const carried: CarriedBrief[] = rawCarried
      .map((b) => {
        const rawPc = typeof b.postcode === "string" ? b.postcode.trim() : "";
        return {
          outcode: String(b.outcode || "").toUpperCase(),
          postcode: rawPc ? rawPc.toUpperCase() : null,
          createdAt: String(b.createdAt || ""),
        };
      })
      .filter((b) => b.outcode.length > 0);

    return { owned, carried };
  } catch {
    return { owned: [], carried: [] };
  }
}

/**
 * Claim an anonymous carry-over into the just-signed-in account. Fired best-effort right
 * after sign-up/sign-in: the server reads the signed HttpOnly `lux_anon` cookie (sent
 * automatically, same-origin) and links its postcode to the account. No-op (and harmless)
 * when there's no cookie or no token. Returns the claimed outcode, or null.
 */
export async function claimAnonBrief(): Promise<string | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch("/api/my-briefs", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "claim" }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const claimed = (data as { claimed?: unknown }).claimed;
    return typeof claimed === "string" && claimed ? claimed : null;
  } catch {
    return null;
  }
}
