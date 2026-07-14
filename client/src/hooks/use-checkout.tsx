// ─── useCheckout ─────────────────────────────────────────────────────────────
// The ONE sanctioned way to start a Stripe checkout.
//
// Two gates, in order:
//   1. SIGNED IN — previously any visitor could click through to a Stripe Payment
//      Link and pay with an arbitrary email. That payment carried no
//      client_reference_id, so the webhook could not tie it to an account: the
//      customer was charged, never upgraded, and later hit "we couldn't find your
//      billing record" on manage/cancel.
//   2. EMAIL VERIFIED — an unverified address may not exist, which means we could
//      take money from someone we can never contact (receipts, renewals, cancellation).
//      Free briefs stay open to unverified users; only paying requires confirmation.
//      This is the least-friction point that still guarantees a real address at the
//      moment money changes hands.
//
// Flow:
//   signed in + verified → Stripe, with client_reference_id + prefilled_email
//   signed out           → remember the plan, open sign-up, resume automatically
//   unverified           → prompt to confirm, with a one-click resend
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getUser } from "@/lib/authStore";
import { checkoutUrl } from "@/lib/checkout";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MailCheck, Loader2 } from "lucide-react";

export function useCheckout() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const pendingUrl = useRef<string | null>(null);

  // Attempts the checkout for a user we believe is signed in. Returns false if a
  // gate blocked it.
  const proceed = useCallback((baseUrl: string): boolean => {
    const current = getUser();
    if (!current) return false;

    if (!current.emailVerified) {
      setVerifyOpen(true);
      return false;
    }

    const url = checkoutUrl(baseUrl); // null when signed out (fail closed)
    if (!url) return false;
    // A direct click by a signed-in user is a real gesture, so a new tab is safe
    // and keeps the site open behind them.
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }, []);

  const startCheckout = useCallback(
    (baseUrl: string) => {
      if (getUser()) {
        proceed(baseUrl);
        return;
      }
      pendingUrl.current = baseUrl;
      setAuthOpen(true);
    },
    [proceed]
  );

  // Resume the moment the user signs in or signs up.
  useEffect(() => {
    if (!user || !pendingUrl.current) return;
    const baseUrl = pendingUrl.current;
    pendingUrl.current = null;
    setAuthOpen(false);

    if (!user.emailVerified) {
      // Brand-new sign-ups land here: account created, confirmation email sent,
      // but they can't pay until they click it.
      setVerifyOpen(true);
      return;
    }

    const url = checkoutUrl(baseUrl);
    if (url) {
      // Same-tab redirect: window.open() after an async auth flow is not a user
      // gesture and gets swallowed by popup blockers.
      window.location.href = url;
    }
  }, [user]);

  const handleAuthClose = useCallback(() => {
    setAuthOpen(false);
    // Read the store directly — after a successful sign-in the `user` from the
    // render closure may still be stale, and we must NOT drop the pending checkout.
    if (!getUser()) pendingUrl.current = null;
  }, []);

  const resendVerification = useCallback(async () => {
    const current = getUser();
    if (!current || resending) return;
    setResending(true);
    try {
      await fetch("/api/auth-email?action=resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: current.email }),
      });
      setResent(true);
    } catch {
      /* deliberately quiet — the endpoint never reveals account existence */
    } finally {
      setResending(false);
    }
  }, [resending]);

  const authModal = (
    <>
      <AuthModal open={authOpen} defaultTab="signup" onClose={handleAuthClose} />

      <Dialog open={verifyOpen} onOpenChange={(v) => { if (!v) { setVerifyOpen(false); setResent(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl tracking-tight">Confirm your email first</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MailCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                We've sent a confirmation link to{" "}
                <span className="font-medium text-foreground">{user?.email}</span>. Click it and
                you can subscribe straight away. This makes sure we can always reach you about
                receipts, renewals and cancellation.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your free briefs still work in the meantime.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={resendVerification}
              disabled={resending || resent}
              data-testid="button-resend-verification"
            >
              {resending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
              ) : resent ? (
                "Confirmation email sent"
              ) : (
                "Resend confirmation email"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return { startCheckout, authModal };
}
