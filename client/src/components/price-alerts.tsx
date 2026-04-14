import { useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AlertEntry {
  email: string;
  postcode: string;
  createdAt: string;
}

// In-memory store for prototype
const alertsStore: AlertEntry[] = [];

export function PriceAlerts() {
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !postcode.trim()) {
      toast({
        title: "Missing details",
        description: "Please enter both an email address and a postcode.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate brief async operation
    setTimeout(() => {
      alertsStore.push({
        email: email.trim(),
        postcode: postcode.trim().toUpperCase(),
        createdAt: new Date().toISOString(),
      });

      toast({
        title: "Alert set!",
        description: `You'll be notified of new sales in ${postcode.trim().toUpperCase()}.`,
      });

      setEmail("");
      setPostcode("");
      setIsSubmitting(false);
    }, 400);
  }

  return (
    <Card
      className="border-amber-600/40 bg-amber-50/5 dark:bg-amber-950/10"
      data-testid="card-price-alerts"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-amber-600" />
          Price Alerts
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Get notified when new sales are recorded in your target area
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="alert-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="alert-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                data-testid="input-alert-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alert-postcode" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Postcode
              </Label>
              <Input
                id="alert-postcode"
                type="text"
                placeholder="SW1A 1AA"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                data-testid="input-alert-postcode"
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            data-testid="button-set-alert"
          >
            <Bell className="h-3.5 w-3.5" />
            {isSubmitting ? "Setting alert…" : "Set Alert"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
