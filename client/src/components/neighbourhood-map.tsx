import { useEffect, useRef } from "react";

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

interface NeighbourhoodMapProps {
  lat: number;
  lng: number;
  postcode: string;
  stations?: Station[];
  schools?: School[];
  amenities?: NearbyAmenities;
}

// Compute approximate position from bearing + distance when real coords unavailable
function bearingOffset(
  cLat: number,
  cLng: number,
  distMetres: number,
  bearingDeg: number
): [number, number] {
  const R = 6371000;
  const d = Math.max(distMetres, 150);
  const ang = (bearingDeg * Math.PI) / 180;
  const dLat = (d * Math.cos(ang)) / R;
  const dLng = (d * Math.sin(ang)) / (R * Math.cos((cLat * Math.PI) / 180));
  return [cLat + (dLat * 180) / Math.PI, cLng + (dLng * 180) / Math.PI];
}

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315, 22, 67, 112, 157, 202, 247, 292, 337];

const LEGEND = [
  { color: "#B8860B", emoji: "📍", label: "Location" },
  { color: "#2563eb", emoji: "🚉", label: "Station" },
  { color: "#16a34a", emoji: "🎓", label: "School" },
  { color: "#ea580c", emoji: "🛒", label: "Shop" },
  { color: "#0d9488", emoji: "🌳", label: "Park" },
  { color: "#dc2626", emoji: "🏥", label: "Health" },
  { color: "#7c3aed", emoji: "☕", label: "Café" },
];

export function NeighbourhoodMap({
  lat,
  lng,
  postcode,
  stations = [],
  schools = [],
  amenities,
}: NeighbourhoodMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const mapHeight = typeof window !== "undefined" && window.innerWidth < 640 ? "280px" : "340px";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const buildMap = async () => {
      if (mapRef.current || !el) return;

      const L = await import("leaflet");

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(el, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        // Dragging always on — required by spec
        dragging: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        touchZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // ── Helper: coloured circle icon ──────────────────────────────────────
      function makeIcon(color: string, emoji: string) {
        return L.divIcon({
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${color};border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3);
            cursor:pointer;
          ">${emoji}</div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
        });
      }

      // Collect all latlngs for fitBounds
      const allLatLngs: [number, number][] = [[lat, lng]];

      // ── Centre pin ────────────────────────────────────────────────────────
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:#B8860B;border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:16px;box-shadow:0 3px 8px rgba(0,0,0,0.4);
          ">📍</div>`,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        }),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(`<strong>${postcode}</strong><br/>Search location`);

      let fallbackIdx = 0;

      function resolvePos(
        itemLat: number | undefined,
        itemLng: number | undefined,
        distMetres: number
      ): [number, number] {
        if (itemLat && itemLng) return [itemLat, itemLng];
        const pos = bearingOffset(lat, lng, distMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
        fallbackIdx++;
        return pos;
      }

      // ── Stations — blue ───────────────────────────────────────────────────
      stations.slice(0, 6).forEach((s) => {
        const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
        allLatLngs.push(pos);
        L.marker(pos, { icon: makeIcon("#2563eb", "🚉") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>` +
              `${s.modes.join(", ")}<br/>` +
              (s.lines.length > 0 ? `Lines: ${s.lines.slice(0, 3).join(", ")}<br/>` : "") +
              `${s.walkMins} min walk (${s.distanceMetres}m)`
          );
      });

      // ── Schools — green ───────────────────────────────────────────────────
      schools.slice(0, 5).forEach((s) => {
        const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
        allLatLngs.push(pos);
        L.marker(pos, { icon: makeIcon("#16a34a", "🎓") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>` +
              `${s.type}<br/>` +
              (s.ofstedRating && s.ofstedRating !== "Not yet rated"
                ? `Ofsted: ${s.ofstedRating}<br/>`
                : "") +
              `${s.walkMins} min walk`
          );
      });

      if (amenities) {
        // ── Supermarkets — orange ─────────────────────────────────────────
        amenities.supermarkets.slice(0, 4).forEach((s) => {
          const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeIcon("#ea580c", "🛒") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // ── Green spaces — teal ───────────────────────────────────────────
        amenities.greenSpaces.slice(0, 4).forEach((s) => {
          const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeIcon("#0d9488", "🌳") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.walkMins} min walk (${s.distanceMetres}m)`);
        });

        // ── Health — red ──────────────────────────────────────────────────
        amenities.health.slice(0, 3).forEach((s) => {
          const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeIcon("#dc2626", "🏥") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // ── Cafes — purple ────────────────────────────────────────────────
        amenities.cafesAndRestaurants.slice(0, 3).forEach((s) => {
          const pos = resolvePos(s.lat, s.lng, s.distanceMetres);
          allLatLngs.push(pos);
          L.marker(pos, { icon: makeIcon("#7c3aed", "☕") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });
      }

      // ── fitBounds to show all pins ────────────────────────────────────────
      if (allLatLngs.length > 1) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }

      // Call invalidateSize after a short pause for layout to settle
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 250);
    };

    // ResizeObserver: trigger map init the moment the container has real px
    // (handles CollapsibleSection {open && ...} lazy mount + Tab reveal)
    roRef.current = new ResizeObserver(() => {
      const { offsetWidth: w, offsetHeight: h } = el;
      if (w > 0 && h > 0) {
        if (!mapRef.current) {
          buildMap();
        } else {
          mapRef.current.invalidateSize();
        }
      }
    });
    roRef.current.observe(el);

    // Also try immediately in case the container is already visible
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      buildMap();
    }

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, postcode]); // stable deps — amenities/stations/schools don't change after mount

  return (
    <div className="space-y-3">
      {/*
        IMPORTANT: Do NOT add overflow:hidden to this div.
        Leaflet positions tile panes absolutely inside the container and they
        must be allowed to overflow. Leaflet manages overflow internally.
        The border-radius is applied via CSS class, not overflow:hidden clip.
      */}
      <div
        ref={containerRef}
        className="w-full rounded-lg border border-border/40"
        style={{
          height: mapHeight,
          minWidth: 0,
          // No overflow:hidden — see comment above
        }}
        data-testid="neighbourhood-map"
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: item.color,
                border: "2px solid white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
              }}
            >
              {item.emoji}
            </div>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Interactive map — drag to pan, pinch or use +/− to zoom. Click any pin for details.
      </p>
    </div>
  );
}
