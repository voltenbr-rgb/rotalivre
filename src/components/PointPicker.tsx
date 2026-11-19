"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { CORUMBA_CENTER } from "@/lib/domain";

type Pt = { lat: number; lng: number };

interface Props {
  /** Ponto que o usuário escolhe (tocar no mapa move o pino) */
  value: Pt | null;
  onChange: (p: Pt) => void;
  /** Pino fixo de referência (ex.: a loja, quando escolhe o ponto de entrega) */
  anchor?: Pt | null;
  anchorEmoji?: string;
  pinEmoji?: string;
  height?: number;
}

/** Mapa claro em que se toca para marcar um ponto (loja ou entrega) */
export default function PointPicker({ value, onChange, anchor, anchorEmoji = "🏪", pinEmoji = "📍", height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const icon = (L: typeof import("leaflet"), emoji: string, ring: string) =>
    L.divIcon({
      className: "",
      html: `<div style="display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:14px;background:${ring};font-size:20px;box-shadow:0 0 0 2px #fff,0 6px 14px rgba(0,0,0,.45)">${emoji}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || mapRef.current) return;
      LRef.current = L;
      const start = value ?? anchor ?? CORUMBA_CENTER;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value || anchor ? 16 : 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      if (anchor) L.marker([anchor.lat, anchor.lng], { icon: icon(L, anchorEmoji, "#fbbf24"), interactive: false }).addTo(map);
      map.on("click", (e) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 80);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pino do ponto escolhido
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) {
      // mapa ainda carregando: tenta de novo em instantes
      const t = setTimeout(() => {
        if (value && LRef.current && mapRef.current && !pinRef.current) {
          pinRef.current = LRef.current
            .marker([value.lat, value.lng], { icon: icon(LRef.current, pinEmoji, "#a3e635") })
            .addTo(mapRef.current);
        }
      }, 400);
      return () => clearTimeout(t);
    }
    if (!value) return;
    if (!pinRef.current) {
      pinRef.current = L.marker([value.lat, value.lng], { icon: icon(L, pinEmoji, "#a3e635") }).addTo(map);
    } else {
      pinRef.current.setLatLng([value.lat, value.lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // Centraliza quando o valor muda por fora (ex.: botão "usar minha localização")
  const lastCentered = useRef<string>("");
  useEffect(() => {
    if (!value || !mapRef.current) return;
    const key = `${value.lat.toFixed(5)},${value.lng.toFixed(5)}`;
    if (key !== lastCentered.current && !mapRef.current.getBounds().contains([value.lat, value.lng])) {
      mapRef.current.setView([value.lat, value.lng], 16);
    }
    lastCentered.current = key;
  }, [value]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <div ref={box} className="absolute inset-0 bg-[#e5e3df]" />
      <p className="pointer-events-none absolute right-2 bottom-6 left-2 z-[500] mx-auto w-fit rounded-full bg-black/70 px-3 py-1 text-center text-[11px] font-semibold text-white">
        Toque no mapa para marcar {pinEmoji}
      </p>
    </div>
  );
}
