import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function ResetPasswordPage() {
  useDocumentTitle("Reset Password");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]token=([^&]+)/);
    if (match) setToken(match[1]);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth-email?action=reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setDone(true);
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
        setTimeout(() => setLocation("/"), 3000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-xs font-semibold tracking-[0.15em] uppercase text-amber-600 cursor-pointer">
              LuxProperty.ai
            </span>
          </Link>
        </div>

        <Card className="p-6 sm:p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-4" />
              <h2 className="font-serif text-lg mb-2">Password updated</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Redirecting you to the homepage…
              </p>
              <Link href="/">
                <Button size="sm">Go to homepage</Button>
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center py-4">
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-4" />
              <h2 className="font-serif text-lg mb-2">Invalid reset link</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This link is invalid or has expired. Please request a new one.
              </p>
              <Link href="/">
                <Button size="sm">Back to homepage</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-xl mb-1">Set a new password</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a new password for your LuxProperty.ai account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    New Password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    data-testid="input-new-password"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={loading}
                    data-testid="input-confirm-password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  disabled={loading || !password || !confirm}
                  data-testid="button-reset-password"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/">
            <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">
              Back to homepage
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
