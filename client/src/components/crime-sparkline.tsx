import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CrimeSparklineProps {
  lat: number;
  lng: number;
}

interface MonthData {
  month: string; // "YYYY-MM"
  count: number;
}

// Module-level cache: keyed by "lat,lng" — persists for the lifetime of the page session.
// This ensures the same postcode always shows the same sparkline, regardless of re-renders.
const sparklineCache: Record<string, MonthData[]> = {};

function getMonthsBack(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  // Police UK data usually lags ~2 months
  now.setMonth(now.getMonth() - 2);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function CrimeSparkline({ lat, lng }: CrimeSparklineProps) {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

    // Return cached data immediately — no re-fetch for same location
    if (sparklineCache[cacheKey]) {
      setData(sparklineCache[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    async function fetchTrend() {
      const months = getMonthsBack(12);
      const results: MonthData[] = [];

      // Fetch sequentially to avoid rate limiting
      for (const month of months) {
        try {
          const res = await fetch(
            `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${month}`
          );
          if (res.ok) {
            const json = await res.json();
            results.push({ month, count: Array.isArray(json) ? json.length : 0 });
          } else {
            results.push({ month, count: 0 });
          }
        } catch {
          results.push({ month, count: 0 });
        }
        // Small delay to be kind to the API
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;
      }

      if (!cancelled) {
        // Store in cache before setting state
        sparklineCache[cacheKey] = results;
        setData(results);
        setLoading(false);
      }
    }

    fetchTrend().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [lat, lng]);

  if (loading) {
    return (
      <div className="space-y-2" data-testid="crime-sparkline-loading">
        <div className="h-16 bg-muted animate-pulse rounded" />
        <p className="text-xs text-muted-foreground">Loading 12-month crime trend…</p>
      </div>
    );
  }

  if (error || data.length === 0) {
    return <p className="text-xs text-muted-foreground">Crime trend data unavailable.</p>;
  }

  const counts = data.map((d) => d.count);
  const max = Math.max(...counts, 1);
  const min = Math.min(...counts);
  const firstHalf = counts.slice(0, 6).reduce((a, b) => a + b, 0);
  const secondHalf = counts.slice(6).reduce((a, b) => a + b, 0);
  const trend = secondHalf > firstHalf * 1.05 ? "up" : secondHalf < firstHalf * 0.95 ? "down" : "flat";

  // Build SVG polyline points
  const width = 280;
  const height = 56;
  const padding = 4;
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (d.count - min) / Math.max(max - min, 1)) * (height - padding * 2);
    return `${x},${y}`;
  });

  const polylineStr = points.join(" ");

  // Closed area fill path
  const fillPath =
    `M${points[0]} ` +
    points.slice(1).map((p) => `L${p}`).join(" ") +
    ` L${padding + (width - padding * 2)},${height - padding} L${padding},${height - padding} Z`;

  const monthLabel = (m: string) => {
    const [, mo] = m.split("-");
    return ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][parseInt(mo) - 1];
  };

  return (
    <div className="space-y-3" data-testid="crime-sparkline">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">12-Month Crime Trend</span>
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          trend === "up" ? "text-red-600 dark:text-red-400" :
          trend === "down" ? "text-green-600 dark:text-green-400" :
          "text-muted-foreground"
        }`}>
          {trend === "up" ? <TrendingUp className="h-3 w-3" /> :
           trend === "down" ? <TrendingDown className="h-3 w-3" /> :
           <Minus className="h-3 w-3" />}
          {trend === "up" ? "Rising" : trend === "down" ? "Falling" : "Stable"}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: 56 }}
        aria-label="12-month crime trend chart"
      >
        {/* Gridlines */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line
            key={i}
            x1={padding}
            y1={padding + f * (height - padding * 2)}
            x2={width - padding}
            y2={padding + f * (height - padding * 2)}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
          />
        ))}
        {/* Fill */}
        <path d={fillPath} fill="currentColor" className="text-primary/15" />
        {/* Line */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-primary"
        />
        {/* Data dots */}
        {data.map((d, i) => {
          const [x, y] = points[i].split(",").map(Number);
          return (
            <circle key={i} cx={x} cy={y} r="2.5" className="fill-primary" />
          );
        })}
      </svg>

      {/* Month labels */}
      <div className="flex justify-between px-1">
        {data.map((d) => (
          <span key={d.month} className="text-[9px] text-muted-foreground font-medium">
            {monthLabel(d.month)}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="text-center p-2 rounded bg-muted/40">
          <p className="text-sm font-bold text-foreground">{counts[counts.length - 1]}</p>
          <p className="text-[10px] text-muted-foreground">Latest month</p>
        </div>
        <div className="text-center p-2 rounded bg-muted/40">
          <p className="text-sm font-bold text-foreground">{Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)}</p>
          <p className="text-[10px] text-muted-foreground">Monthly avg</p>
        </div>
        <div className="text-center p-2 rounded bg-muted/40">
          <p className="text-sm font-bold text-foreground">{max}</p>
          <p className="text-[10px] text-muted-foreground">Peak month</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Source: data.police.uk — Police recorded crime, 1km radius.</p>
    </div>
  );
}
