// ─── useCheckout ─────────────────────────────────────────────────────────────
// The ONE sanctioned way to start a Stripe checkout.
//
// Requires the user to be signed in before they can pay. Previously any visitor
// could click straight through to a Stripe Payment Link and pay with an arbitrary
// email; that payment carried no client_reference_id, so the webhook could not tie
// it to an account. The user got charged, was never upgraded, and later saw
// "we couldn't find your billing record" on manage/cancel.
//
// Flow:
//   signed in     → open Stripe with client_reference_id + prefilled_email attached
//   not signed in → remember the plan they picked, open the sign-up modal, and
//                   RESUME automatically to that plan's checkout once they're in.
//
// AuthModal has no onSuccess callback and calls onClose() on BOTH success and
// dismissal, so we cannot tell them apart from onClose. Instead we drive the
// resume off the auth-state transition (authStore is subscribable, so useAuth
// re-renders when the user appears) and only discard the pending checkout on
// close if there is still no signed-in user — i.e. they genuinely cancelled.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getUser } from "@/lib/authStore";
import { checkoutUrl } from "@/lib/checkout";
import { AuthModal } from "@/components/auth-modal";

export function useCheckout() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const pendingUrl = useRef<string | null>(null);

  const startCheckout = useCallback((baseUrl: string) => {
    const url = checkoutUrl(baseUrl); // null when signed out (fail closed)
    if (url) {
      // Direct click by a signed-in user is a real user gesture, so a new tab is
      // safe here and keeps the site open behind them.
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    pendingUrl.current = baseUrl;
    setAuthOpen(true);
  }, []);

  // Resume the checkout the moment the user signs in or signs up.
  useEffect(() => {
    if (!user || !pendingUrl.current) return;
    const url = checkoutUrl(pendingUrl.current);
    pendingUrl.current = null;
    setAuthOpen(false);
    if (url) {
      // Same-tab redirect: window.open() after an async auth flow is not treated
      // as a user gesture and gets swallowed by popup blockers.
      window.location.href = url;
    }
  }, [user]);

  const handleClose = useCallback(() => {
    setAuthOpen(false);
    // Read the store directly — after a successful sign-in the `user` from the
    // render closure may still be stale, and we must NOT drop the pending
    // checkout in that case.
    if (!getUser()) pendingUrl.current = null;
  }, []);

  const authModal = (
    <AuthModal open={authOpen} defaultTab="signup" onClose={handleClose} />
  );

  return { startCheckout, authModal };
}
