// ─── Full Brief one-off checkout (client wiring) ─────────────────────────────
// The ONE sanctioned way to start a £149 Full Brief purchase for a postcode.
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
import { track } from "./analytics";

export type FullBriefCheckoutResult =
  | { status: "redirecting" }
  | { status: "signin-required" }
  | { status: "already-owned"; outcode: string }
  | { status: "error"; message: string };

// `outcode` is passed by callers purely for analytics tagging (they hold it from the
// brief location context). It is NOT sent to the server — the server resolves the
// canonical outcode from `postcode` itself. Early failures may only know `postcode`.
export async function startFullBriefCheckout(postcode: string, outcode?: string): Promise<FullBriefCheckoutResult> {
  track("unlock_click", { outcode });

  // Fail closed: no token → sign-in first (mirrors checkout.ts for subscriptions).
  // This is the intended cold-traffic signup path, NOT a checkout failure.
  if (!getToken()) {
    track("signup_modal_shown", { outcode });
    return { status: "signin-required" };
  }

  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ postcode }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (res.ok && typeof data.url === "string") {
      track("checkout_session_created", { outcode });
      // Same-tab redirect: window.open() after an await is swallowed by popup blockers.
      window.location.href = data.url;
      return { status: "redirecting" };
    }
    // 401 = token invalid/expired → same signup path as the no-token case, not a failure.
    if (res.status === 401) {
      track("signup_modal_shown", { outcode });
      return { status: "signin-required" };
    }
    // Every genuine non-ok outcome (409 already-owned, 400/502/503 server errors) surfaces
    // as checkout_failed carrying the server's error code — so a misconfigured
    // STRIPE_PRICE_FULLBRIEF shows up as { code: "PRICE_MISCONFIGURED" }, distinguishable
    // from a user who simply changed their mind.
    const code = String(data.code || `HTTP_${res.status}`);
    if (res.status === 409) {
      const owned = String(data.outcode || outcode || "").toUpperCase();
      track("checkout_failed", { code, outcode: owned });
      return { status: "already-owned", outcode: owned };
    }
    track("checkout_failed", { code, outcode: String(data.outcode || outcode || "").toUpperCase() });
    return {
      status: "error",
      message: String(data.error || "Could not start checkout. Please try again."),
    };
  } catch {
    track("checkout_failed", { code: "NETWORK", outcode });
    return { status: "error", message: "Could not reach the server. Check your connection and try again." };
  }
}
