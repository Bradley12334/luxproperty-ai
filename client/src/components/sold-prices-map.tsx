import { useEffect, useRef } from "react";

interface SoldPrice {
  address: string;
  price: string;
  date: string;
  type: string;
  lat: number;
  lng: number;
}

interface SoldPricesMapProps {
  soldPrices: SoldPrice[];
  centerLat?: number;
  centerLng?: number;
}

export function SoldPricesMap({ soldPrices, centerLat, centerLng }: SoldPricesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || soldPrices.length === 0) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const firstPin = soldPrices[0];
      const center: [number, number] = centerLat && centerLng
        ? [centerLat, centerLng]
        : [firstPin.lat, firstPin.lng];

      const map = L.map(mapRef.current!, {
        center,
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      soldPrices.forEach((sp) => {
        const soldIcon = L.divIcon({
          html: `<div style="
            background: #B8860B;
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 3px 6px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            border: 1.5px solid rgba(255,255,255,0.6);
            font-family: system-ui, sans-serif;
          ">${sp.price}</div>`,
          className: "",
          iconSize: [80, 22],
          iconAnchor: [40, 22],
          popupAnchor: [0, -24],
        });

        L.marker([sp.lat, sp.lng], { icon: soldIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-size:12px; font-family: system-ui, sans-serif; line-height: 1.5;">
              <strong style="font-size:13px;">${sp.price}</strong><br/>
              <span style="color:#666;">${sp.address}</span><br/>
              <span style="color:#999;">${sp.type} · ${sp.date}</span>
            </div>
          `);
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [soldPrices, centerLat, centerLng]);

  if (soldPrices.length === 0) return null;

  return (
    <div
      ref={mapRef}
      style={{ height: "320px", width: "100%", borderRadius: "0.5rem", overflow: "hidden" }}
      data-testid="sold-prices-map"
    />
  );
}
