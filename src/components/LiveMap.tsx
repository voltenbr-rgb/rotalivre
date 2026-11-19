"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

type Pt = { lat: number; lng: number };

/** Mapa só de visualização: loja, destino e o entregador ao vivo */
export default function LiveMap({
  pickup, delivery, courier, courierEmoji = "🛵", storeEmoji = "🏪", height = 220,
}: { pickup: Pt; delivery: Pt; courier: Pt | null; courierEmoji?: string; storeEmoji?: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const courierRef = useRef<Marker | null>(null);
  const followed = useRef(false);

  const icon = (L: typeof import("leaflet"), emoji: string, bg: string, size = 36) =>
    L.divIcon({
      className: "",
      html: `<div style="display:flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;border-radius:12px;background:${bg};font-size:${Math.round(size * 0.52)}px;box-shadow:0 0 0 2px #fff,0 6px 14px rgba(0,0,0,.4)">${emoji}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(box.current, { zoomControl: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      L.marker([pickup.lat, pickup.lng], { icon: icon(L, storeEmoji, "#fbbf24"), interactive: false }).addTo(map);
      L.marker([delivery.lat, delivery.lng], { icon: icon(L, "🏠", "#a3e635"), interactive: false }).addTo(map);
      map.fitBounds(L.latLngBounds([[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]]), { padding: [36, 36], maxZoom: 16 });
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 80);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      courierRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza o entregador a cada nova posição
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const L = LRef.current;
      const map = mapRef.current;
      if (!L || !map) {
        t = setTimeout(apply, 300);
        return;
      }
      if (!courier) {
        courierRef.current?.remove();
        courierRef.current = null;
        return;
      }
      if (!courierRef.current) {
        courierRef.current = L.marker([courier.lat, courier.lng], { icon: icon(L, courierEmoji, "#0ea5e9", 42), zIndexOffset: 1000 }).addTo(map);
      } else {
        courierRef.current.setLatLng([courier.lat, courier.lng]);
      }
      if (!followed.current) {
        followed.current = true;
        map.fitBounds(
          L.latLngBounds([[pickup.lat, pickup.lng], [delivery.lat, delivery.lng], [courier.lat, courier.lng]]),
          { padding: [36, 36], maxZoom: 16 },
        );
      }
    };
    apply();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier?.lat, courier?.lng]);

  return <div ref={box} style={{ height }} className="w-full overflow-hidden rounded-2xl" />;
}
