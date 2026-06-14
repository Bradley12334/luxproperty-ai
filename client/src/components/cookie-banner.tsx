import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "lux_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try { localStorage.setItem(CONSENT_KEY, "accepted"); } catch {}
    setVisible(false);
    // Enable GA after consent
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  }

  function decline() {
    try { localStorage.setItem(CONSENT_KEY, "declined"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl bg-background border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
          We use cookies to understand how people use LuxProperty.ai and improve the experience.
          By clicking Accept, you consent to our use of analytics cookies. See our{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={decline}
            data-testid="button-cookie-decline"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            data-testid="button-cookie-accept"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
