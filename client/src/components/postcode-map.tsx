/**
 * PostcodeMap — Location Map shown in the Overview tab accordion.
 *
 * Same wrapper pattern as NeighbourhoodMap:
 * - Outer div carries border-radius + overflow:hidden (for visual rounding)
 * - Inner div is the plain Leaflet host (no decorative CSS)
 *
 * border-radius on the Leaflet host div triggers GPU compositing that
 * offsets Leaflet's CSS transform-based tile positioning → fragmented tiles.
 */

import { useEffect, useRef } from "react";

interface PostcodeMapProps {
  postcode: string;
  lat?: number;
  lng?: number;
  areaName?: string;
}

export function PostcodeMap({ postcode, lat, lng, areaName }: PostcodeMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;

    async function buildMap() {
      if (mapInstanceRef.current || initStartedRef.current || !mapEl) return;
      if (mapEl.clientWidth === 0 || mapEl.clientHeight === 0) return;

      initStartedRef.current = true;

      const L = await import("leaflet");

      if (!mapEl.isConnected || mapInstanceRef.current) {
        initStartedRef.current = false;
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number] = lat && lng ? [lat, lng] : [51.505, -0.09];

      const map = L.map(mapEl, {
        center: coords,
        zoom: lat && lng ? 14 : 12,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        tap: true,
        doubleClickZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
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
            `<div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">
              <strong style="font-size:14px">${postcode}</strong><br>
              <span style="color:#6b7280">${areaName || ""}</span>
            </div>`,
            { offset: [0, -8] },
          )
          .openPopup();
      }

      mapInstanceRef.current = map;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 300);
    }

    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    function attemptInit() {
      if (mapInstanceRef.current || initStartedRef.current) return;
      rafId = requestAnimationFrame(() => {
        timeoutId = setTimeout(buildMap, 50);
      });
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (!mapInstanceRef.current) {
            attemptInit();
          } else {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        }
      }
    });
    ro.observe(mapEl);

    attemptInit();

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
  }, [lat, lng, postcode, areaName]);

  return (
    <>
      {/* Outer wrapper — carries border-radius and visual clip */}
      <div
        className="w-full rounded-lg overflow-hidden border border-border/40"
        style={{ height: 260 }}
      >
        {/* Inner Leaflet host — plain, no decorative CSS */}
        <div
          ref={mapElRef}
          style={{ width: "100%", height: "100%" }}
          aria-label={`Map showing ${postcode}`}
        />
      </div>
    </>
  );
}
