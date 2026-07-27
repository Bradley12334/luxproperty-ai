// ─── Full Brief one-off checkout (client wiring) ─────────────────────────────
// The ONE sanctioned way to start a £14.99 Full Brief purchase for a postcode.
// Calls the server (POST /api/create-checkout) with the VERIFIED session token —
// never a client userId — and returns a discriminated result the caller renders:
//
//   redirecting     → we've sent the browser to Stripe Checkout (nothing more to do)
//   signin-required → no valid token; caller opens the auth modal, then retries
//   already-owned   → the account already owns this district; caller opens the brief
//   error           → show `message`
//
// The postcode travels in the body; the server resolves it to the canonical outcode,
// refuses invalid/unsupported postcodes, and blocks a repeat purchase (409).
import { authHeader, getToken } from "./authStore";

export type FullBriefCheckoutResult =
  | { status: "redirecting" }
  | { status: "signin-required" }
  | { status: "already-owned"; outcode: string }
  | { status: "error"; message: string };

export async function startFullBriefCheckout(postcode: string): Promise<FullBriefCheckoutResult> {
  // Fail closed: no token → sign-in first (mirrors checkout.ts for subscriptions).
  if (!getToken()) return { status: "signin-required" };

  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ postcode }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok && typeof data.url === "string") {
      // Same-tab redirect: window.open() after an await is swallowed by popup blockers.
      window.location.href = data.url;
      return { status: "redirecting" };
    }
    if (res.status === 401) return { status: "signin-required" };
    if (res.status === 409) {
      return { status: "already-owned", outcode: String(data.outcode || "").toUpperCase() };
    }
    return {
      status: "error",
      message: String(data.error || "Could not start checkout. Please try again."),
    };
  } catch {
    return { status: "error", message: "Could not reach the server. Check your connection and try again." };
  }
}
