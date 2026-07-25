import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "./auth-modal";
import { getUser, needsReauth, subscribe } from "@/lib/authStore";

/**
 * Deploy-transition prompt for the session-token security upgrade.
 *
 * A user who was signed in BEFORE signed session tokens existed has a cached account
 * but no token (see restoreSession()), so they can no longer authenticate to the API.
 * Instead of silently rendering anonymous / locked content, we show a gentle banner
 * asking them to sign in again — which mints a token and clears the flag. Anonymous
 * visitors and normally-signed-in users never see this.
 */
export function ReauthBanner() {
  const [show, setShow] = useState(needsReauth());
  const [name, setName] = useState(getUser()?.name ?? "");
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    return subscribe(() => {
      setShow(needsReauth());
      setName(getUser()?.name ?? "");
    });
  }, []);

  if (!show) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl bg-background border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
            {name ? `Welcome back, ${name}. ` : ""}We've upgraded account security — please
            sign in again to continue with your full account. Your plan and data are unchanged.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setAuthOpen(true)}
              data-testid="button-reauth-signin"
            >
              Sign in again
            </Button>
          </div>
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab="signin" />
    </>
  );
}
