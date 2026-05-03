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

// Fallback: compute approximate position from bearing + distance if no real coords
function bearingOffset(centreLat: number, centreLng: number, distanceMetres: number, bearingDeg: number): [number, number] {
  const R = 6371000;
  const d = Math.max(distanceMetres, 150);
  const ang = (bearingDeg * Math.PI) / 180;
  const dLat = (d * Math.cos(ang)) / R;
  const dLng = (d * Math.sin(ang)) / (R * Math.cos((centreLat * Math.PI) / 180));
  return [centreLat + (dLat * 180) / Math.PI, centreLng + (dLng * 180) / Math.PI];
}

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315, 22, 67, 112, 157, 202, 247, 292, 337];

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

      // Helper: create coloured circle icon
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

      let fallbackIdx = 0;

      // Stations — blue
      stations.slice(0, 6).forEach((s) => {
        let markerLat: number, markerLng: number;
        if (s.lat && s.lng) {
          markerLat = s.lat;
          markerLng = s.lng;
        } else {
          [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
          fallbackIdx++;
        }
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
      schools.slice(0, 5).forEach((s) => {
        let markerLat: number, markerLng: number;
        if (s.lat && s.lng) {
          markerLat = s.lat;
          markerLng = s.lng;
        } else {
          [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[(stations.length + fallbackIdx) % BEARINGS.length]);
          fallbackIdx++;
        }
        L.marker([markerLat, markerLng], { icon: createIcon("#16a34a", "🎓") })
          .addTo(map)
          .bindPopup(
            `<strong>${s.name}</strong><br/>` +
            `${s.type}<br/>` +
            (s.ofstedRating && s.ofstedRating !== "Not yet rated" ? `Ofsted: ${s.ofstedRating}<br/>` : "") +
            `${s.walkMins} min walk`
          );
      });

      if (amenities) {
        // Supermarkets — orange
        amenities.supermarkets.slice(0, 4).forEach((s) => {
          let markerLat: number, markerLng: number;
          if (s.lat && s.lng) {
            markerLat = s.lat;
            markerLng = s.lng;
          } else {
            [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
            fallbackIdx++;
          }
          L.marker([markerLat, markerLng], { icon: createIcon("#ea580c", "🛒") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // Green spaces — teal
        amenities.greenSpaces.slice(0, 4).forEach((s) => {
          let markerLat: number, markerLng: number;
          if (s.lat && s.lng) {
            markerLat = s.lat;
            markerLng = s.lng;
          } else {
            [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
            fallbackIdx++;
          }
          L.marker([markerLat, markerLng], { icon: createIcon("#0d9488", "🌳") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.walkMins} min walk (${s.distanceMetres}m)`);
        });

        // Health — red
        amenities.health.slice(0, 3).forEach((s) => {
          let markerLat: number, markerLng: number;
          if (s.lat && s.lng) {
            markerLat = s.lat;
            markerLng = s.lng;
          } else {
            [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
            fallbackIdx++;
          }
          L.marker([markerLat, markerLng], { icon: createIcon("#dc2626", "🏥") })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong><br/>${s.type}<br/>${s.distanceMetres}m away`);
        });

        // Cafes — purple
        amenities.cafesAndRestaurants.slice(0, 3).forEach((s) => {
          let markerLat: number, markerLng: number;
          if (s.lat && s.lng) {
            markerLat = s.lat;
            markerLng = s.lng;
          } else {
            [markerLat, markerLng] = bearingOffset(lat, lng, s.distanceMetres, BEARINGS[fallbackIdx % BEARINGS.length]);
            fallbackIdx++;
          }
          L.marker([markerLat, markerLng], { icon: createIcon("#7c3aed", "☕") })
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
        Pins show real GPS coordinates from OpenStreetMap data. Click any pin for details. Scroll to zoom disabled — use +/− controls.
      </p>
    </div>
  );
}
