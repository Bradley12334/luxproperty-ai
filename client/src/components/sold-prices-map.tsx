import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/* ────────────────────────────────────────────────────────────────────────────
 * Sold Prices Map (INV) — brief-only component, rebuilt clean for Phase 2b.
 *
 * Plots recent in-district sales at their POSTCODE CENTROIDS (not exact property
 * locations — the section labels this). Leaflet is already a dependency; tiles are
 * CARTO's light basemap. Markers are coloured by the server-computed price tier.
 * Leaflet is dynamically imported so it only loads when a map is actually shown.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface MapPoint {
  id: string;
  address: string;
  postcode: string;
  price: { raw: number | null; formatted: string };
  propertyType: string;
  monthYear: string;
  tier: "low" | "mid-low" | "mid" | "mid-high" | "high";
  lat: number | null;
  lng: number | null;
}

const TIER_COLOUR: Record<MapPoint["tier"], string> = {
  low: "#3b82f6",
  "mid-low": "#22c55e",
  mid: "#eab308",
  "mid-high": "#f97316",
  high: "#a855f7",
};

export function SoldPricesMap({
  centre,
  subjectLabel,
  points,
  height = 360,
}: {
  centre: { lat: number; lng: number };
  subjectLabel: string;
  points: MapPoint[];
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const plotted = points.filter((p) => p.lat != null && p.lng != null) as (MapPoint & {
      lat: number;
      lng: number;
    })[];

    import("leaflet").then((L) => {
      if (cancelled || !elRef.current) return;

      const map = L.map(elRef.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const latlngs: [number, number][] = [];

      // Subject marker (the resolved postcode centroid).
      const subjectIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#B8860B;border:3px solid #fff;box-shadow:0 0 0 2px #B8860B"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([centre.lat, centre.lng], { icon: subjectIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:11px;font-family:system-ui,sans-serif;font-weight:600;color:#B8860B">${escapeHtml(
            subjectLabel,
          )}</div>`,
        );
      latlngs.push([centre.lat, centre.lng]);

      // Sale markers, coloured by price tier.
      for (const p of plotted) {
        const colour = TIER_COLOUR[p.tier] ?? "#6b7280";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${colour};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-size:12px;font-family:system-ui,sans-serif;line-height:1.5;min-width:170px">
               <div style="font-size:14px;font-weight:700;color:#1a1612;margin-bottom:2px">${escapeHtml(
                 p.price.formatted,
               )}</div>
               <div style="color:#374151;font-size:11px;margin-bottom:2px">${escapeHtml(p.address)}</div>
               <div style="color:#6b7280;font-size:11px">${escapeHtml(p.propertyType)}${
                 p.monthYear ? " · " + escapeHtml(p.monthYear) : ""
               }</div>
             </div>`,
          );
        latlngs.push([p.lat, p.lng]);
      }

      if (latlngs.length > 1) {
        map.fitBounds(latlngs as any, { padding: [30, 30], maxZoom: 16 });
      } else {
        map.setView([centre.lat, centre.lng], 14);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, centre.lat, centre.lng, subjectLabel]);

  return (
    <div
      ref={elRef}
      style={{ height, width: "100%", borderRadius: "0.5rem", overflow: "hidden" }}
      data-testid="sold-prices-map"
    />
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
