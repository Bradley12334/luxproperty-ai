/**
 * NeighbourhoodMap — clean Leaflet/OSM implementation
 *
 * Key implementation decisions:
 *
 * 1. WRAPPER PATTERN — border-radius lives on the outer wrapper div, NOT on
 *    the div Leaflet mounts into. Leaflet's tile panes use CSS transform for
 *    positioning; border-radius on the same element triggers GPU compositing
 *    that offsets those transforms, causing the fragmented tile bug.
 *
 * 2. NO overflow:hidden ON THE LEAFLET CONTAINER — Leaflet's own CSS already
 *    sets overflow:hidden on .leaflet-container. Adding it to the host element
 *    clips absolutely-positioned panes during initialisation.
 *
 * 3. FIXED HEIGHT via explicit px value on the wrapper — percentage heights
 *    and 'auto' fail inside flex/grid parents that don't have a fixed height
 *    themselves; Leaflet reads clientHeight and gets 0.
 *
 * 4. DELAYED INIT — the component is mounted by CollapsibleSection only when
 *    open=true ({open && <children>}). At that exact moment, the browser
 *    hasn't flushed a layout pass yet. We defer with requestAnimationFrame
 *    + a short setTimeout so Leaflet always reads real px dimensions.
 *
 * 5. SINGLE INSTANCE GUARD — mapRef.current is checked before init and the
 *    initStarted flag prevents double-init from concurrent RAF + RO callbacks.
 *
 * 6. fitBounds — called after all markers are added so all POIs are visible
 *    on first open.
 */

import { useEffect, useRef } from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Station {
  name: string;
  lines: string[];
  modes: string[];
  distanceMetres: number;
  walkMins: number;
  lat?: number;
  lng?: number;
}

interface School {
  name: string;
  type: string;
  ofstedRating: string;
  distanceMetres: number;
  walkMins: number;
  lat?: number;
  lng?: number;
}

interface Amenity {
  name: string;
  type: string;
  distanceMetres: number;
  lat?: number;
  lng?: number;
}

interface GreenSpace {
  name: string;
  distanceMetres: number;
  walkMins: number;
  lat?: number;
  lng?: number;
}

interface NearbyAmenities {
  supermarkets: Amenity[];
  cafesAndRestaurants: Amenity[];
  health: Amenity[];
  greenSpaces: GreenSpace[];
}

export interface NeighbourhoodMapProps {
  lat: number;
  lng: number;
  postcode: string;
  stations?: Station[];
  schools?: School[];
  amenities?: NearbyAmenities;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Approximate lat/lng from a bearing + distance when real coords are absent.
 * Minimum distance clamped to 150 m so pins don't cluster at the centre.
 */
function bearingOffset(
  cLat: number,
  cLng: number,
  distMetres: number,
  bearingDeg: number,
): [number, number] {
  const R = 6_371_000;
  const d = Math.max(distMetres, 150);
  const ang = (bearingDeg * Math.PI) / 180;
  const dLat = (d * Math.cos(ang)) / R;
  const dLng = (d * Math.sin(ang)) / (R * Math.cos((cLat * Math.PI) / 180));
  return [cLat + (dLat * 180) / Math.PI, cLng + (dLng * 180) / Math.PI];
}

// Spread fallback pins evenly around the compass
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315, 22, 67, 112, 157, 202, 247, 292, 337];

const LEGEND_ITEMS = [
  { color: "#B8860B", emoji: "📍", label: "Location" },
  { color: "#2563eb", emoji: "🚉", label: "Station" },
  { color: "#16a34a", emoji: "🎓", label: "School" },
  { color: "#ea580c", emoji: "🛒", label: "Shop" },
  { color: "#0d9488", emoji: "🌳", label: "Park" },
  { color: "#dc2626", emoji: "🏥", label: "Health" },
  { color: "#7c3aed", emoji: "☕", label: "Café" },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export function NeighbourhoodMap({
  lat,
  lng,
  postcode,
  stations = [],
  schools = [],
  amenities,
}: NeighbourhoodMapProps) {
  /**
   * wrapperRef — outer div that carries border-radius + clip.
   * mapElRef   — inner div that Leaflet mounts into; completely plain.
   */
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;

    /* ── Build map (called once, after layout is flushed) ──────────────── */
    async function buildMap() {
      // Double-check: bail if already initialised or init already in progress
      if (mapInstanceRef.current || initStartedRef.current || !mapEl) return;
      // Bail if dimensions still not available (shouldn't happen after RAF)
      if (mapEl.clientWidth === 0 || mapEl.clientHeight === 0) return;

      initStartedRef.current = true;

      const L = await import("leaflet");

      // If something unmounted while we were awaiting the import, bail
      if (!mapEl.isConnected || mapInstanceRef.current) {
        initStartedRef.current = false;
        return;
      }

      /* Fix Leaflet default icon paths broken by Vite bundling */
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      /* Create map */
      const map = L.map(mapEl, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        tap: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        touchZoom: true,
      });

      /* Tile layer */
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      /* ── Icon factory ────────────────────────────────────────────────── */
      function makeCircleIcon(color: string, emoji: string, size = 32) {
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${color};border:2.5px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:${Math.round(size * 0.44)}px;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            cursor:pointer;line-height:1;
          ">${emoji}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -(size / 2 + 4)],
        });
      }

      /* ── Collect all latlngs for fitBounds ───────────────────────────── */
      const allLatLngs: L.LatLngTuple[] = [[lat, lng]];

      /* Centre pin */
      L.marker([lat, lng], { icon: makeCircleIcon("#B8860B", "📍", 36), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<strong>${postcode}</strong><br/>Search location`);

      let fallbackIdx = 0;

      function resolveLatLng(
        iLat: number | undefined,
        iLng: number | undefined,
        distMetres: number,
      ): L.LatLngTuple {
        if (iLat && iLng) return [iLat, iLng];
        const pos = bearingOffset(lat, lng, distMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
        fallbackIdx++;
        return pos;
      }

      /* Stations — blue */
      stations.slice(0, 6).forEach((s) => {
        const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
        allLatLngs.push(pos);
        L.marker(pos, { icon: makeCircleIcon("#2563eb", "🚉") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>${s.modes.join(", ")}` +
            (s.lines.length ? `<br/>Lines: ${s.lines.slice(0, 3).join(", ")}` : "") +
            `<br/>${s.walkMins} min walk (${s.distanceMetres}m)`,
          );
      });

      /* Schools — green */
      schools.slice(0, 5).forEach((s) => {
        const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
        allLatLngs.push(pos);
        L.marker(pos, { icon: makeCircleIcon("#16a34a", "🎓") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>${s.type}` +
            (s.ofstedRating && s.ofstedRating !== "Not yet rated"
              ? `<br/>Ofsted: ${s.ofstedRating}`
              : "") +
            `<br/>${s.walkMins} min walk`,
          );
      });

      if (amenities) {
        /* Supermarkets — orange */
        amenities.supermarkets.slice(0, 4).forEach((s) => {
          const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeCircleIcon("#ea580c", "🛒") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        /* Green spaces — teal */
        amenities.greenSpaces.slice(0, 4).forEach((s) => {
          const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeCircleIcon("#0d9488", "🌳") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.walkMins} min walk (${s.distanceMetres}m)`);
        });

        /* Health — red */
        amenities.health.slice(0, 3).forEach((s) => {
          const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeCircleIcon("#dc2626", "🏥") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        /* Cafés — purple */
        amenities.cafesAndRestaurants.slice(0, 3).forEach((s) => {
          const pos = resolveLatLng(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeCircleIcon("#7c3aed", "☕") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });
      }

      /* ── fitBounds so all markers are visible on first load ──────────── */
      if (allLatLngs.length > 1) {
        map.fitBounds(L.latLngBounds(allLatLngs), { padding: [36, 36], maxZoom: 15 });
      }

      /* ── Force tile re-render after fitBounds settles ────────────────── */
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 300);
    }

    /* ── Defer init until browser has flushed a real layout pass ─────── */
    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    function attemptInit() {
      if (mapInstanceRef.current || initStartedRef.current) return;
      rafId = requestAnimationFrame(() => {
        // One more frame for the layout to fully settle (esp. inside tabs)
        timeoutId = setTimeout(buildMap, 50);
      });
    }

    /* ResizeObserver watches the map element — fires when it gains real px */
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!mapInstanceRef.current) {
            attemptInit();
          } else {
            // Already initialised — just tell Leaflet the size changed
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        }
      }
    });
    ro.observe(mapEl);

    // Also try immediately in case the element is already visible
    attemptInit();

    /* ── Cleanup on unmount ──────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      ro.disconnect();
      initStartedRef.current = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, postcode]); // amenities/stations/schools are stable after mount

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      {/*
        OUTER WRAPPER — carries the decorative border-radius and clip.
        The clip here is intentional: it rounds the visual corners of the
        rendered map. Leaflet's internal panes are positioned relative to
        the inner mapEl, so they are unaffected by this outer clip.
      */}
      <div
        ref={wrapperRef}
        className="w-full rounded-lg border border-border/40 overflow-hidden"
        style={{ height: typeof window !== "undefined" && window.innerWidth < 640 ? 280 : 340 }}
      >
        {/*
          INNER LEAFLET HOST — must be clean: no border-radius, no overflow,
          no transform, no decorative CSS. 100% × 100% of the wrapper.
          Leaflet sets position:relative on this element itself.
        */}
        <div
          ref={mapElRef}
          style={{ width: "100%", height: "100%" }}
          data-testid="neighbourhood-map"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: item.color,
                border: "2px solid white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                flexShrink: 0,
              }}
            >
              {item.emoji}
            </div>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Interactive map — drag to pan, +/− or pinch to zoom. Click any pin for details.
      </p>
    </div>
  );
}
