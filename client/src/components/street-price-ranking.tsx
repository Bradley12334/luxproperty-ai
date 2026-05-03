import { TrendingUp, TrendingDown } from "lucide-react";

interface SoldPrice {
  address: string;
  price: string;
  date: string;
  type: string;
  lat: number;
  lng: number;
}

interface StreetData {
  street: string;
  avgPrice: number;
  count: number;
}

function parsePrice(priceStr: string): number {
  return parseInt(priceStr.replace(/[^0-9]/g, ""), 10) || 0;
}

function extractStreet(address: string): string {
  // Address format: "14 BAKER STREET, LONDON, W1U 3BW"
  // Take the first comma-separated segment, strip the house number prefix
  const part = address.split(",")[0]?.trim() ?? address;
  // Remove leading house number (digits at start)
  return part.replace(/^\d+[A-Z]?\s+/, "").trim();
}

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

interface StreetPriceRankingProps {
  soldPrices: SoldPrice[];
}

export function StreetPriceRanking({ soldPrices }: StreetPriceRankingProps) {
  if (!soldPrices || soldPrices.length === 0) {
    return <p className="text-xs text-muted-foreground">No sold price data available for street analysis.</p>;
  }

  // Group by street
  const streetMap: Record<string, number[]> = {};
  soldPrices.forEach((s) => {
    const street = extractStreet(s.address);
    if (!street || street.length < 3) return;
    if (!streetMap[street]) streetMap[street] = [];
    streetMap[street].push(parsePrice(s.price));
  });

  // Build sorted list — only streets with at least 1 sale
  const streets: StreetData[] = Object.entries(streetMap)
    .filter(([, prices]) => prices.length >= 1)
    .map(([street, prices]) => ({
      street,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: prices.length,
    }))
    .sort((a, b) => b.avgPrice - a.avgPrice);

  if (streets.length === 0) {
    return <p className="text-xs text-muted-foreground">Insufficient street-level data for ranking.</p>;
  }

  const top5 = streets.slice(0, 5);
  const bottom5 = streets.length >= 5 ? streets.slice(-5).reverse() : [];

  const overallAvg = streets.reduce((a, b) => a + b.avgPrice, 0) / streets.length;

  return (
    <div className="space-y-4" data-testid="street-price-ranking">
      {/* Most expensive */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Premium Streets
          </span>
        </div>
        <div className="space-y-1.5">
          {top5.map((s, i) => {
            const pct = ((s.avgPrice - overallAvg) / overallAvg) * 100;
            const barWidth = Math.min((s.avgPrice / (top5[0].avgPrice || 1)) * 100, 100);
            return (
              <div key={s.street} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-primary shrink-0">#{i + 1}</span>
                    <span className="text-xs font-medium text-foreground truncate">{s.street}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-foreground">{fmt(s.avgPrice)}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      +{pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Based on {s.count} {s.count === 1 ? "sale" : "sales"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Most affordable */}
      {bottom5.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Most Affordable Streets
            </span>
          </div>
          <div className="space-y-1.5">
            {bottom5.map((s) => {
              const pct = ((s.avgPrice - overallAvg) / overallAvg) * 100;
              const barWidth = Math.min((s.avgPrice / (top5[0].avgPrice || 1)) * 100, 100);
              return (
                <div key={s.street} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground truncate min-w-0">{s.street}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-foreground">{fmt(s.avgPrice)}</span>
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500/60 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Based on {s.count} {s.count === 1 ? "sale" : "sales"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Average by street calculated from recent HM Land Registry transactions in this postcode area.
        Streets with limited transactions may not be fully representative.
      </p>
    </div>
  );
}
