import { Footprints } from "lucide-react";

interface Station {
  distanceMetres: number;
}
interface School {
  distanceMetres: number;
}
interface Amenity {
  distanceMetres: number;
}
interface GreenSpace {
  distanceMetres: number;
}
interface NearbyAmenities {
  supermarkets: Amenity[];
  cafesAndRestaurants: Amenity[];
  health: Amenity[];
  greenSpaces: GreenSpace[];
}

interface WalkScoreProps {
  stations?: Station[];
  schools?: School[];
  amenities?: NearbyAmenities;
  /** Area-level walkability (0–10 scale from neighbourhoodProfile) used as a
   *  floor when live Overpass data is sparse or absent. Prevents 0/100 on
   *  areas with good transport/amenities where Overpass simply returned nothing. */
  areaWalkability?: number;
}

export function calculateWalkScore(stations: Station[] = [], schools: School[] = [], amenities?: NearbyAmenities): number {
  let score = 0;

  // Station within 400m → +25
  if (stations.some((s) => s.distanceMetres <= 400)) score += 25;
  else if (stations.some((s) => s.distanceMetres <= 800)) score += 12;

  // Shop within 400m → +20
  const allShops = [...(amenities?.supermarkets ?? []), ...(amenities?.cafesAndRestaurants ?? [])];
  if (allShops.some((s) => s.distanceMetres <= 400)) score += 20;
  else if (allShops.some((s) => s.distanceMetres <= 800)) score += 10;

  // Park within 800m → +15
  if (amenities?.greenSpaces?.some((s) => s.distanceMetres <= 800)) score += 15;
  else if (amenities?.greenSpaces?.some((s) => s.distanceMetres <= 1500)) score += 7;

  // School within 800m → +10
  if (schools.some((s) => s.distanceMetres <= 800)) score += 10;
  else if (schools.some((s) => s.distanceMetres <= 1500)) score += 5;

  // Health within 800m → +10
  if (amenities?.health?.some((s) => s.distanceMetres <= 800)) score += 10;
  else if (amenities?.health?.some((s) => s.distanceMetres <= 1500)) score += 5;

  // Café within 400m → +20
  if (amenities?.cafesAndRestaurants?.some((s) => s.distanceMetres <= 400)) score += 20;
  else if (amenities?.cafesAndRestaurants?.some((s) => s.distanceMetres <= 800)) score += 10;

  return Math.min(score, 100);
}

function getScoreLabel(score: number): { label: string; colour: string } {
  if (score >= 90) return { label: "Walker's Paradise", colour: "#16a34a" };
  if (score >= 70) return { label: "Very Walkable", colour: "#22c55e" };
  if (score >= 50) return { label: "Somewhat Walkable", colour: "#eab308" };
  if (score >= 25) return { label: "Car-Dependent", colour: "#f97316" };
  return { label: "Minimal Walkability", colour: "#dc2626" };
}

export function WalkScore({ stations = [], schools = [], amenities, areaWalkability }: WalkScoreProps) {
  const liveScore = calculateWalkScore(stations, schools, amenities);
  // If live Overpass data is absent/sparse and we have an area walkability signal,
  // use it as a floor. areaWalkability is on a 0–10 scale → convert to 0–100.
  // Only apply if live score is suspiciously low (< 20) to avoid overriding real data.
  const fallbackScore = areaWalkability != null ? Math.round(areaWalkability * 10) : 0;
  const score = liveScore < 20 && fallbackScore > liveScore ? fallbackScore : liveScore;
  const usingFallback = score !== liveScore;
  const { label, colour } = getScoreLabel(score);
  const circumference = 2 * Math.PI * 40; // r=40

  return (
    <div className="flex flex-wrap items-center gap-6" data-testid="walk-score">
      {/* Circular gauge */}
      <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={colour}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground" style={{ color: colour }}>{score}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">/100</span>
        {usingFallback && <span className="text-[8px] text-muted-foreground/60 mt-0.5">est.</span>}
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Walk Score</span>
        </div>
        <span className="text-base font-semibold" style={{ color: colour }}>{label}</span>
        <div className="space-y-0.5">
          {[
            { label: "Stations", ok: stations.some((s) => s.distanceMetres <= 400) },
            { label: "Shops", ok: [...(amenities?.supermarkets ?? [])].some((s) => s.distanceMetres <= 400) },
            { label: "Parks", ok: amenities?.greenSpaces?.some((s) => s.distanceMetres <= 800) ?? false },
            { label: "Schools", ok: schools.some((s) => s.distanceMetres <= 800) },
            { label: "Health", ok: amenities?.health?.some((s) => s.distanceMetres <= 800) ?? false },
          ].map(({ label: l, ok }) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <span className="text-xs text-muted-foreground">{l}</span>
              <span className="text-xs font-medium text-foreground">{ok ? "✓ Nearby" : "Further away"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
