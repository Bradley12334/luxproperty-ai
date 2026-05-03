import { useEffect, useRef } from "react";

interface Station {
  name: string;
  lines: string[];
  modes: string[];
  distanceMetres: number;
  walkMins: number;
}

interface School {
  name: string;
  type: string;
  ofstedRating: string;
  distanceMetres: number;
  walkMins: number;
}

interface Amenity {
  name: string;
  type: string;
  distanceMetres: number;
}

interface GreenSpace {
  name: string;
  distanceMetres: number;
  walkMins: number;
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

// Rough offset in degrees for a given distance in metres
function offsetFromCentre(distanceMetres: number, bearing: number) {
  // 1 degree lat ≈ 111,000m; 1 degree lng ≈ 111,000m * cos(lat)
  const latDeg = 0.000009 * distanceMetres; // ~1m per 0.000009 deg
  const lngDeg = 0.000012 * distanceMetres;
  const angle = (bearing * Math.PI) / 180;
  return {
    lat: Math.sin(angle) * latDeg * 0.7,
    lng: Math.cos(angle) * lngDeg * 0.7,
  };
}

export function NeighbourhoodMap({ lat, lng, postcode, stations = [], schools = [], amenities }: NeighbourhoodMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Helper: create circle icon
      function createIcon(color: string, emoji: string) {
        return L.divIcon({
          html: `<div style="
            width:32px;height:32px;border-radius:50%;
            background:${color};border:2px solid white;
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

      // Centre pin (gold)
      const centreIcon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:#B8860B;border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,0.4);
        ">📍</div>`,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      L.marker([lat, lng], { icon: centreIcon })
        .addTo(map)
        .bindPopup(`<strong>${postcode}</strong><br/>Search location`);

      // Bearings to space things out visually
      const bearings = [0, 45, 90, 135, 180, 225, 270, 315, 22, 67, 112, 157, 202, 247, 292, 337];

      // Stations — blue
      stations.slice(0, 6).forEach((s, i) => {
        const offset = offsetFromCentre(Math.max(s.distanceMetres, 150), bearings[i % bearings.length]);
        const markerLat = lat + offset.lat;
        const markerLng = lng + offset.lng;
        L.marker([markerLat, markerLng], { icon: createIcon("#2563eb", "🚉") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>` +
            `${s.modes.join(", ")}<br/>` +
            (s.lines.length > 0 ? `Lines: ${s.lines.slice(0, 3).join(", ")}<br/>` : "") +
            `${s.walkMins} min walk (${s.distanceMetres}m)`
          );
      });

      // Schools — green
      schools.slice(0, 5).forEach((s, i) => {
        const bIdx = (stations.length + i) % bearings.length;
        const offset = offsetFromCentre(Math.max(s.distanceMetres, 150), bearings[bIdx]);
        L.marker([lat + offset.lat, lng + offset.lng], { icon: createIcon("#16a34a", "🎓") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>` +
            `${s.type}<br/>` +
            (s.ofstedRating && s.ofstedRating !== "Not yet rated" ? `Ofsted: ${s.ofstedRating}<br/>` : "") +
            `${s.walkMins} min walk`
          );
      });

      if (amenities) {
        const baseIdx = stations.length + schools.length;

        // Supermarkets — orange
        amenities.supermarkets.slice(0, 4).forEach((s, i) => {
          const bIdx = (baseIdx + i) % bearings.length;
          const offset = offsetFromCentre(Math.max(s.distanceMetres, 100), bearings[bIdx]);
          L.marker([lat + offset.lat, lng + offset.lng], { icon: createIcon("#ea580c", "🛒") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // Green spaces — teal
        amenities.greenSpaces.slice(0, 4).forEach((s, i) => {
          const bIdx = (baseIdx + amenities.supermarkets.length + i) % bearings.length;
          const offset = offsetFromCentre(Math.max(s.distanceMetres, 100), bearings[bIdx]);
          L.marker([lat + offset.lat, lng + offset.lng], { icon: createIcon("#0d9488", "🌳") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.walkMins} min walk (${s.distanceMetres}m)`);
        });

        // Health — red
        amenities.health.slice(0, 3).forEach((s, i) => {
          const bIdx = (baseIdx + amenities.supermarkets.length + amenities.greenSpaces.length + i) % bearings.length;
          const offset = offsetFromCentre(Math.max(s.distanceMetres, 100), bearings[bIdx]);
          L.marker([lat + offset.lat, lng + offset.lng], { icon: createIcon("#dc2626", "🏥") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // Cafes — purple
        amenities.cafesAndRestaurants.slice(0, 3).forEach((s, i) => {
          const bIdx = (baseIdx + amenities.supermarkets.length + amenities.greenSpaces.length + amenities.health.length + i) % bearings.length;
          const offset = offsetFromCentre(Math.max(s.distanceMetres, 100), bearings[bIdx]);
          L.marker([lat + offset.lat, lng + offset.lng], { icon: createIcon("#7c3aed", "☕") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, postcode]);

  // Legend items
  const legend = [
    { color: "#B8860B", emoji: "📍", label: "Location" },
    { color: "#2563eb", emoji: "🚉", label: "Station" },
    { color: "#16a34a", emoji: "🎓", label: "School" },
    { color: "#ea580c", emoji: "🛒", label: "Shop" },
    { color: "#0d9488", emoji: "🌳", label: "Park" },
    { color: "#dc2626", emoji: "🏥", label: "Health" },
    { color: "#7c3aed", emoji: "☕", label: "Café" },
  ];

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        style={{ height: "340px", width: "100%", borderRadius: "0.5rem", overflow: "hidden", zIndex: 0 }}
        data-testid="neighbourhood-map"
      />
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {legend.map((item) => (
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
        Markers are approximate. Click any pin for details. Scroll to zoom disabled — use +/- controls.
      </p>
    </div>
  );
}
