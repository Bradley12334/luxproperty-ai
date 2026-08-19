import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { refreshUser } from "@/lib/authStore";
import { track } from "@/lib/analytics";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

/**
 * /verify-email?token=...
 * Landing page for the confirmation link sent at sign-up. Confirms the address
 * exists and belongs to the person who signed up — which is what lets us require
 * a verified email before someone can subscribe.
 */
export default function VerifyEmailPage() {
  useDocumentTitle("Confirm your email");

  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This link is missing its confirmation token. Please use the link from your email.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth-email?action=verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "We couldn't confirm your email. The link may have expired.");
          return;
        }
        // Pull the updated record so emailVerified is true in this session too.
        await refreshUser();
        track("verification_completed");
        setStatus("ok");
      } catch {
        setStatus("error");
        setMessage("We couldn't reach the server. Please check your connection and try again.");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        {status === "working" && (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-5" />
            <p className="text-sm text-muted-foreground">Confirming your email…</p>
          </>
        )}

        {status === "ok" && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-center mb-3">Email confirmed</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8">
              Thanks — your address is verified. You can now subscribe and we'll always be able to reach you about your account.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Link href="/" className="flex-1">
                <Button className="w-full" data-testid="button-verify-run-brief">Run a brief</Button>
              </Link>
              <Link href="/pricing" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-verify-pricing">See plans</Button>
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-center mb-3">We couldn't confirm that link</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-8" data-testid="text-verify-error">
              {message}
            </p>
            <Link href="/account">
              <Button variant="outline" data-testid="button-verify-account">Go to my account</Button>
            </Link>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
