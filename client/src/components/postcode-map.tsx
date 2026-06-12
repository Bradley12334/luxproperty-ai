import { useEffect, useRef } from "react";

interface PostcodeMapProps {
  postcode: string;
  lat?: number;
  lng?: number;
  areaName?: string;
}

export function PostcodeMap({ postcode, lat, lng, areaName }: PostcodeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default icon paths (webpack/vite issue)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number] = lat && lng ? [lat, lng] : [51.505, -0.09];

      const map = L.map(mapRef.current!, {
        center: coords,
        zoom: lat && lng ? 14 : 12,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (lat && lng) {
        const goldIcon = L.divIcon({
          html: `<div style="
            width: 32px; height: 32px;
            background: #B8860B;
            border: 3px solid #fff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });

        L.marker(coords, { icon: goldIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:-apple-system,sans-serif;font-size:13px;line-height:1.5">
              <strong style="font-size:14px">${postcode}</strong><br>
              <span style="color:#6b7280">${areaName || ""}</span>
            </div>`,
            { offset: [0, -8] }
          )
          .openPopup();
      }

      mapInstanceRef.current = map;

      // invalidateSize after a short delay so the accordion animation settles
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      // ResizeObserver: re-invalidate whenever the container gains real dimensions
      // (handles cases where accordion/tab reveals the map after init)
      if (mapRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            const el = mapRef.current;
            if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
              mapInstanceRef.current.invalidateSize();
            }
          }
        });
        ro.observe(mapRef.current);
        // Store ro on the map instance so we can disconnect it on cleanup
        (mapInstanceRef.current as any)._roObserver = ro;
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        if ((mapInstanceRef.current as any)._roObserver) {
          (mapInstanceRef.current as any)._roObserver.disconnect();
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, postcode, areaName]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div
        ref={mapRef}
        className="w-full rounded-lg overflow-hidden border border-border/40"
        style={{ height: 260 }}
        aria-label={`Map showing ${postcode}`}
      />
    </>
  );
}
