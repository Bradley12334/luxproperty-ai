import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signIn, signUp } from "@/lib/authStore";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
}

export function AuthModal({ open, onClose, defaultTab = "signin" }: AuthModalProps) {
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function reset() {
    setName(""); setEmail(""); setPassword(""); setError(""); setShowPassword(false);
  }

  function switchTab(t: "signin" | "signup") {
    setTab(t);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Small delay for perceived loading
    await new Promise(r => setTimeout(r, 400));

    if (tab === "signup") {
      const result = await signUp(name, email, password);
      if (!result.ok) {
        setError(result.error || "Sign up failed.");
        setLoading(false);
        return;
      }
      toast({ title: "Welcome to LuxProperty.ai", description: "Your account has been created." });
    } else {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error || "Sign in failed.");
        setLoading(false);
        return;
      }
      toast({ title: "Welcome back", description: "You've signed in successfully." });
    }

    setLoading(false);
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tight">
            {tab === "signin" ? "Sign in to LuxProperty.ai" : "Create your account"}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-2">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === t
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t}`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {tab === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name" className="text-xs text-muted-foreground">
                Full name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="auth-name"
                  type="text"
                  placeholder="Bradley Skana"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  autoComplete="name"
                  data-testid="input-auth-name"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs text-muted-foreground">
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                autoComplete={tab === "signin" ? "username" : "email"}
                data-testid="input-auth-email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-xs text-muted-foreground">
              Password {tab === "signup" && <span className="font-normal">(min. 6 characters)</span>}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9"
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                data-testid="input-auth-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-auth-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full font-semibold"
            disabled={loading}
            data-testid="button-auth-submit"
          >
            {loading
              ? "Please wait…"
              : tab === "signin"
              ? "Sign In"
              : "Create Account"}
          </Button>

          {tab === "signup" && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              By creating an account you agree to our{" "}
              <a href="/#/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/#/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
