import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function PriceAlerts() {
  return (
    <Card
      className="border-amber-600/30 bg-amber-50/5 dark:bg-amber-950/10"
      data-testid="card-price-alerts"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-amber-600" />
          Price Alerts
          <span className="ml-1 inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-400/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
            Coming Soon
          </span>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Get notified when new sales land in your target postcodes. Launching for Investor users soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          You'll be able to set alerts for any UK postcode district and receive a notification each time a new Land Registry transaction is recorded. We'll let you know when this is live.
        </p>
      </CardContent>
    </Card>
  );
}
