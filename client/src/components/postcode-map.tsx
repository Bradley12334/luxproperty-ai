import { useEffect, useRef } from "react";

interface PostcodeMapProps {
  postcode: string;
  lat?: number;
  lng?: number;
  areaName?: string;
}

export function PostcodeMap({ postcode, lat, lng, areaName }: PostcodeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const el = containerRef.current;

    const initMap = (L: any) => {
      if (mapRef.current || !el) return;

      // Fix default icon paths (vite/webpack don't bundle them automatically)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number] = lat && lng ? [lat, lng] : [51.505, -0.09];

      const map = L.map(el, {
        center: coords,
        zoom: lat && lng ? 14 : 12,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
        // Ensure Leaflet doesn't try to animate before container is sized
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (lat && lng) {
        const goldIcon = L.divIcon({
          html: `<div style="
            width:32px;height:32px;
            background:#B8860B;
            border:3px solid #fff;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
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

      mapRef.current = map;

      // Initial invalidateSize after accordion animation settles
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, 250);
    };

    // ResizeObserver: init map only when container has real px dimensions,
    // then call invalidateSize on subsequent resizes (tab switches, accordions)
    roRef.current = new ResizeObserver(() => {
      const { offsetWidth: w, offsetHeight: h } = el;
      if (w > 0 && h > 0) {
        if (!mapRef.current) {
          import("leaflet").then(initMap);
        } else {
          mapRef.current.invalidateSize();
        }
      }
    });
    roRef.current.observe(el);

    // Also attempt immediately in case container is already visible
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      import("leaflet").then(initMap);
    }

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, postcode, areaName]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-border/40"
      style={{
        height: 260,
        // Do NOT use overflow:hidden — Leaflet tile panes are position:absolute
        // and will be clipped. Leaflet manages its own overflow internally.
        minWidth: 0,
      }}
      aria-label={`Map showing ${postcode}`}
    />
  );
}
