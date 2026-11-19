"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  CloudRainWind, ExternalLink, Flag, LocateFixed, LocateOff, MapPin, Navigation,
  Search, ShieldExclamationPoint, Siren, Store, TriangleExclamationPoint, Users, X,
} from "lucide-react";
import type { Map as LeafletMap, Marker, LayerGroup } from "leaflet";
import type { Courier, Order, Partner } from "@/lib/types";
import { fmtBRL, fmtKm, ALERT_META } from "@/lib/format";
import { apiFetch } from "@/lib/session";
import {
  BRAZIL_BOUNDS, BRAZIL_CITIES, REGION_BY_UF, REGION_COLORS, REGION_LABELS,
  searchCities, type BrazilCity,
} from "@/lib/brazil";
import PttButton from "./PttButton";
import { useWakeLock, type useGeolocation } from "@/lib/useGeolocation";

interface Props {
  courier: Courier;
  activeOrder: Order | null;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
  onOrderAction: (order: Order, action: "pickup" | "deliver") => Promise<void>;
  /** GPS compartilhado pelo AppShell (fica ligado em todas as abas) */
  gps: ReturnType<typeof useGeolocation>;
}

type ViewMode = "rota" | "brasil";
type LatLng = { lat: number; lng: number };
type RouteInfo = { coords: [number, number][]; km: number; min: number };

const BIKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0c10" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0c10" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

const ALERTS = [
  { type: "blitz", label: "Blitz", icon: ShieldExclamationPoint, classes: "border-sky-400/40 bg-sky-400/12 text-sky-200" },
  { type: "alagamento", label: "Alagamento", icon: CloudRainWind, classes: "border-cyan-400/40 bg-cyan-400/12 text-cyan-200" },
  { type: "risco", label: "Área de risco", icon: TriangleExclamationPoint, classes: "border-amber-400/40 bg-amber-400/12 text-amber-200" },
  { type: "restaurante", label: "Restaurante lento", icon: Store, classes: "border-orange-400/40 bg-orange-400/12 text-orange-200" },
  { type: "sos", label: "SOS", icon: Siren, classes: "border-red-500/60 bg-red-500/20 text-red-200" },
] as const;

function hav(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Rota real de ruas via OSRM (gratuito, sem chave) — com retorno nulo em caso de falha */
async function fetchStreetRoute(a: LatLng, b: LatLng): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
    );
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
      km: Math.round((route.distance / 1000) * 10) / 10,
      min: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}

export default function MapView({ courier, activeOrder, notify, onOrderAction, gps }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const courierMarkerRef = useRef<Marker | null>(null);
  const routeGroupRef = useRef<LayerGroup | null>(null);
  const partnerGroupRef = useRef<LayerGroup | null>(null);
  const brazilGroupRef = useRef<LayerGroup | null>(null);
  const areaGroupRef = useRef<LayerGroup | null>(null);
  const cityMarkerRef = useRef<Marker | null>(null);
  const statesLoadingRef = useRef(false);
  const viewModeRef = useRef<ViewMode>("rota");
  const posRef = useRef({ lat: courier.baseLat, lng: courier.baseLng });
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [pos, setPos] = useState(posRef.current);
  const [radarOn, setRadarOn] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("rota");
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<BrazilCity[]>([]);
  const [selectedCity, setSelectedCity] = useState<BrazilCity | null>(null);
  const [deliveryRoute, setDeliveryRoute] = useState<RouteInfo | null>(null);
  const [pickupRoute, setPickupRoute] = useState<RouteInfo | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const statesLayerStore = useRef<LayerGroup | null>(null);
  const accuracyCircleRef = useRef<import("leaflet").Circle | null>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const [confirmArmed, setConfirmArmed] = useState(false);

  /* ---------- GPS real do celular ---------- */
  const gpsActive = gps.status === "active";
  // Tela sempre acesa durante uma entrega com GPS ligado
  useWakeLock(gpsActive && !!activeOrder);

  /* ---------- init do mapa ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      leafletRef.current = L;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
        [courier.baseLat, courier.baseLng],
        13,
      );
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div class="rl-courier-wrap"><div class="rl-courier-pulse"></div><div class="rl-courier-dot">${BIKE_SVG}</div></div>`,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });
      courierMarkerRef.current = L.marker([posRef.current.lat, posRef.current.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      areaGroupRef.current = L.layerGroup().addTo(map);
      routeGroupRef.current = L.layerGroup().addTo(map);
      partnerGroupRef.current = L.layerGroup().addTo(map);
      brazilGroupRef.current = L.layerGroup().addTo(map);

      // Círculo do raio de atuação ao redor da base
      L.circle([courier.baseLat, courier.baseLng], {
        radius: courier.workRadiusKm * 1000,
        color: "#a3e635",
        weight: 1.5,
        opacity: 0.45,
        fillColor: "#a3e635",
        fillOpacity: 0.05,
        dashArray: "6 8",
      }).addTo(areaGroupRef.current);

      // Arrastar o mapa desliga o "seguir minha posição"
      map.on("dragstart", () => {
        followRef.current = false;
        setFollowing(false);
      });

      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 60);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- parceiros (radar) ---------- */
  const loadPartners = useCallback(async () => {
    try {
      const res = await apiFetch("/api/partners");
      const data = await res.json();
      setPartners(data.partners ?? []);
    } catch { /* mantém */ }
  }, []);

  useEffect(() => {
    loadPartners();
    const t = setInterval(loadPartners, 20000);
    return () => clearInterval(t);
  }, [loadPartners]);

  useEffect(() => {
    const L = leafletRef.current;
    const group = partnerGroupRef.current;
    if (!mapReady || !L || !group) return;
    group.clearLayers();
    if (!radarOn || viewMode === "brasil") return;
    for (const p of partners) {
      const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
      const icon = L.divIcon({
        className: "",
        html: `<div class="rl-marker rl-partner ${p.status === "em_entrega" ? "busy" : ""}">${initials}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([p.lat, p.lng], { icon }).addTo(group)
        .bindTooltip(`${p.nickname} • ${p.distanceKm.toFixed(1)} km${p.live ? " • GPS ao vivo" : ""}`, { direction: "top", offset: [0, -14], className: "rl-tip" });
    }
  }, [partners, radarOn, mapReady, viewMode]);

  /* ---------- rota da entrega ativa (partida → destino automáticos) ---------- */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = routeGroupRef.current;
    if (!mapReady || !L || !map || !group) return;
    group.clearLayers();
    if (!activeOrder) {
      setDeliveryRoute(null);
      setPickupRoute(null);
      return;
    }
    let cancelled = false;
    const pickup: [number, number] = [activeOrder.pickupLat, activeOrder.pickupLng];
    const drop: [number, number] = [activeOrder.deliveryLat, activeOrder.deliveryLng];

    const pinIcon = (bg: string, chip: string) =>
      L.divIcon({
        className: "",
        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div class="rl-marker" style="width:44px;height:44px;background:${bg};box-shadow:0 0 0 3px rgba(255,255,255,0.85),0 10px 22px rgba(0,0,0,0.65)">${PIN_SVG}</div>
          <span class="rl-pin-chip" style="background:${bg}">${chip}</span>
        </div>`,
        iconSize: [120, 68],
        iconAnchor: [60, 24],
      });

    const draw = (delCoords: [number, number][], pickCoords: [number, number][] | null) => {
      if (cancelled) return;
      group.clearLayers();
      if (pickCoords && activeOrder.status === "accepted") {
        L.polyline(pickCoords, { color: "#fbbf24", weight: 11, opacity: 0.22 }).addTo(group);
        L.polyline(pickCoords, { color: "#fbbf24", weight: 5.5, opacity: 0.9 }).addTo(group);
        L.polyline(pickCoords, { color: "#fff7e0", weight: 2.5, opacity: 0.9, className: "route-line" }).addTo(group);
      }
      // brilho sob a rota + traçado principal partida → destino
      L.polyline(delCoords, { color: "#a3e635", weight: 12, opacity: 0.25 }).addTo(group);
      L.polyline(delCoords, { color: "#a3e635", weight: 6, opacity: 0.98 }).addTo(group);
      L.polyline(delCoords, { color: "#0a0c10", weight: 2, opacity: 0.65, className: "route-line" }).addTo(group);
      L.marker(pickup, { icon: pinIcon("#fbbf24", "PARTIDA"), zIndexOffset: 800 }).addTo(group)
        .bindTooltip(`Partida (coleta): ${activeOrder.establishment} — ${activeOrder.pickupNeighborhood}`, { direction: "top", offset: [0, -30], className: "rl-tip" });
      L.marker(drop, { icon: pinIcon("#34d399", "DESTINO"), zIndexOffset: 800 }).addTo(group)
        .bindTooltip(`Destino: ${activeOrder.clientName} — ${activeOrder.deliveryNeighborhood}`, { direction: "top", offset: [0, -30], className: "rl-tip" });
    };

    draw([pickup, drop], null);
    if (viewMode === "rota") {
      map.fitBounds([pickup, drop, [posRef.current.lat, posRef.current.lng]], { padding: [55, 55], maxZoom: 15 });
    }

    (async () => {
      const [del, pick] = await Promise.all([
        fetchStreetRoute({ lat: pickup[0], lng: pickup[1] }, { lat: drop[0], lng: drop[1] }),
        activeOrder.status === "accepted"
          ? fetchStreetRoute(posRef.current, { lat: pickup[0], lng: pickup[1] })
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setDeliveryRoute(del);
      setPickupRoute(pick);
      draw(del?.coords ?? [pickup, drop], pick?.coords ?? null);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeOrder?.id, activeOrder?.status, gpsActive]);

  /* ---------- modo Brasil todo: capitais, cidades e estados ---------- */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = brazilGroupRef.current;
    if (!mapReady || !L || !map || !group) return;

    if (viewMode === "brasil") {
      group.clearLayers();

      // 1) Estados coloridos por região — GeoJSON servido pelo próprio app (sem depender de rede externa)
      if (statesLayerStore.current) {
        statesLayerStore.current.addTo(group);
      } else if (!statesLoadingRef.current) {
        statesLoadingRef.current = true;
        fetch("/geo/brazil-states.geojson")
          .then((r) => {
            if (!r.ok) throw new Error("geojson indisponível");
            return r.json();
          })
          .then((geo) => {
            const layer = L.geoJSON(geo, {
              style: (feature) => {
                const sigla = (feature?.properties as { sigla?: string } | undefined)?.sigla ?? "";
                const color = REGION_COLORS[REGION_BY_UF[sigla] ?? ""] ?? "#a3e635";
                return { color, weight: 1.6, opacity: 0.9, fillColor: color, fillOpacity: 0.14 };
              },
              onEachFeature: (feature, lyr) => {
                const p = feature?.properties as { name?: string; sigla?: string } | undefined;
                if (p?.name) {
                  lyr.bindTooltip(`${p.name} (${p.sigla}) • Região ${REGION_BY_UF[p.sigla ?? ""] ?? ""}`, { className: "rl-tip" });
                }
              },
            });
            statesLayerStore.current = layer as unknown as LayerGroup;
            if (viewModeRef.current === "brasil") layer.addTo(group);
          })
          .catch(() => {
            statesLoadingRef.current = false; // permite nova tentativa ao reabrir o modo
          });
      }

      // 2) Rótulos das 5 regiões
      for (const r of REGION_LABELS) {
        const icon = L.divIcon({
          className: "",
          html: `<div class="rl-region-label" style="color:${REGION_COLORS[r.region]}">${r.label}</div>`,
          iconSize: [130, 18],
          iconAnchor: [65, 9],
        });
        L.marker([r.lat, r.lng], { icon, interactive: false }).addTo(group);
      }

      // 3) Capitais (com UF) e principais cidades
      for (const city of BRAZIL_CITIES) {
        const icon = L.divIcon({
          className: "",
          html: `<div class="rl-marker ${city.capital ? "rl-capital" : "rl-city-dot"}">${city.capital ? city.uf : ""}</div>`,
          iconSize: city.capital ? [20, 20] : [9, 9],
          iconAnchor: city.capital ? [10, 10] : [5, 5],
        });
        const marker = L.marker([city.lat, city.lng], { icon, zIndexOffset: 500 }).addTo(group);
        marker.bindTooltip(
          city.capital ? `★ ${city.name} — ${city.uf} (capital)` : `${city.name} — ${city.uf}`,
          { direction: "top", offset: [0, -8], className: "rl-tip" },
        );
        marker.on("click", () => selectCity(city, false));
      }
      map.flyToBounds(BRAZIL_BOUNDS, { padding: [12, 12], duration: 1.2 });
    } else {
      group.clearLayers();
      if (activeOrder) {
        map.flyToBounds(
          [
            [activeOrder.pickupLat, activeOrder.pickupLng],
            [activeOrder.deliveryLat, activeOrder.deliveryLng],
            [posRef.current.lat, posRef.current.lng],
          ],
          { padding: [55, 55], maxZoom: 15, duration: 1 },
        );
      } else {
        map.flyTo([posRef.current.lat, posRef.current.lng], 13, { duration: 1 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, viewMode]);

  /* ---------- mantém o ref do modo sincronizado ---------- */
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  /* ---------- corrida aceita = rota na tela, automaticamente ---------- */
  const lastOrderIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeOrder && activeOrder.id !== lastOrderIdRef.current) {
      lastOrderIdRef.current = activeOrder.id;
      if (viewModeRef.current === "brasil") setViewMode("rota");
    }
    if (!activeOrder) lastOrderIdRef.current = null;
  }, [activeOrder]);

  /* ---------- busca e seleção de cidade ---------- */
  const selectCity = (city: BrazilCity, fly = true) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    setSelectedCity(city);
    setCityResults([]);
    setCityQuery(`${city.name} — ${city.uf}`);
    if (!L || !map) return;
    if (cityMarkerRef.current) cityMarkerRef.current.remove();
    const icon = L.divIcon({
      className: "",
      html: `<div class="rl-marker rl-city-marker">${PIN_SVG}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    cityMarkerRef.current = L.marker([city.lat, city.lng], { icon, zIndexOffset: 900 }).addTo(map);
    if (fly) map.flyTo([city.lat, city.lng], 11, { duration: 1.4 });
  };

  const onCityQuery = (q: string) => {
    setCityQuery(q);
    setCityResults(searchCities(q));
    if (q.trim().length < 2) setSelectedCity(null);
  };

  const clearCity = () => {
    setSelectedCity(null);
    setCityQuery("");
    setCityResults([]);
    cityMarkerRef.current?.remove();
    cityMarkerRef.current = null;
  };

  /* ---------- posição real (GPS) ---------- */
  const firstFixRef = useRef(true);
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const f = gps.fix;
    if (!mapReady || !L || !map || !f) return;
    const next = { lat: f.lat, lng: f.lng };
    posRef.current = next;
    courierMarkerRef.current?.setLatLng([next.lat, next.lng]);
    setPos(next);

    // Círculo de precisão do GPS
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([next.lat, next.lng], {
        radius: f.accuracy,
        color: "#38bdf8",
        weight: 1,
        opacity: 0.5,
        fillColor: "#38bdf8",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng([next.lat, next.lng]).setRadius(f.accuracy);
    }

    if (firstFixRef.current) {
      firstFixRef.current = false;
      if (!activeOrder && viewModeRef.current === "rota") map.flyTo([next.lat, next.lng], 15, { duration: 0.8 });
    } else if (followRef.current && viewModeRef.current === "rota") {
      map.panTo([next.lat, next.lng], { animate: true, duration: 0.6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.fix, mapReady]);

  /* ---------- movimento simulado (somente sem GPS: modo demonstração) ---------- */
  useEffect(() => {
    if (gpsActive) return;
    const t = setInterval(() => {
      const cur = posRef.current;
      let target = { lat: courier.baseLat, lng: courier.baseLng };
      if (activeOrder) {
        target =
          activeOrder.status === "accepted"
            ? { lat: activeOrder.pickupLat, lng: activeOrder.pickupLng }
            : { lat: activeOrder.deliveryLat, lng: activeOrder.deliveryLng };
      }
      const dist = hav(cur.lat, cur.lng, target.lat, target.lng);
      let next = cur;
      if (dist > 0.03) {
        const step = activeOrder ? 0.055 : 0.01;
        next = {
          lat: cur.lat + (target.lat - cur.lat) * step,
          lng: cur.lng + (target.lng - cur.lng) * step,
        };
      } else if (!activeOrder) {
        next = {
          lat: cur.lat + (Math.random() - 0.5) * 0.0006,
          lng: cur.lng + (Math.random() - 0.5) * 0.0006,
        };
      }
      posRef.current = next;
      courierMarkerRef.current?.setLatLng([next.lat, next.lng]);
      setPos(next);
    }, 2000);
    return () => clearInterval(t);
  }, [activeOrder, courier.baseLat, courier.baseLng, gpsActive]);

  /* ---------- confirmação: zera o "confirmar mesmo assim" ao trocar de etapa ---------- */
  useEffect(() => {
    setConfirmArmed(false);
  }, [activeOrder?.id, activeOrder?.status]);

  const nextTarget = activeOrder
    ? activeOrder.status === "accepted"
      ? { lat: activeOrder.pickupLat, lng: activeOrder.pickupLng, label: "Partida (coleta)" }
      : { lat: activeOrder.deliveryLat, lng: activeOrder.deliveryLng, label: "Destino (cliente)" }
    : null;
  const distToTarget = nextTarget ? hav(pos.lat, pos.lng, nextTarget.lat, nextTarget.lng) : 0;
  const navKm = activeOrder?.status === "accepted" && pickupRoute ? pickupRoute.km : deliveryRoute && activeOrder?.status === "picked_up" ? deliveryRoute.km : distToTarget * 1.32;
  const navMin = activeOrder?.status === "accepted" && pickupRoute ? pickupRoute.min : deliveryRoute && activeOrder?.status === "picked_up" ? deliveryRoute.min : Math.max(1, Math.round(distToTarget * 2.6));
  // Distância real até o ponto da etapa atual (para liberar a confirmação)
  const GEOFENCE_KM = 0.25;
  const farFromTarget = gpsActive && !!nextTarget && distToTarget > GEOFENCE_KM;
  const distLabel = distToTarget < 1 ? `${Math.round(distToTarget * 1000)} m` : fmtKm(Math.round(distToTarget * 10) / 10);
  const navGoogle = nextTarget ? `https://www.google.com/maps/dir/?api=1&destination=${nextTarget.lat},${nextTarget.lng}` : "#";
  const navWaze = nextTarget ? `https://waze.com/ul?ll=${nextTarget.lat},${nextTarget.lng}&navigate=yes` : "#";

  const sendAlert = async (type: (typeof ALERTS)[number]["type"]) => {
    const meta = ALERT_META[type];
    const content =
      type === "sos"
        ? "Preciso de ajuda agora! Pane/acidente — quem estiver perto, por favor venha."
        : `${meta.label} em ${courier.neighborhood} — registrado via mapa`;
    try {
      await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "Zona Sul",
          kind: "alerta",
          alertType: type,
          content,
          neighborhood: courier.neighborhood,
          lat: posRef.current.lat,
          lng: posRef.current.lng,
        }),
      });
      if (type === "sos") {
        notify("SOS enviado! Parceiros num raio de 5 km foram alertados", "sos");
        if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 200]);
      } else {
        notify(`Alerta de ${meta.label.toLowerCase()} enviado à rede`);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    } catch {
      notify("Falha ao enviar alerta", "warn");
    }
  };

  const sendPtt = async (durationSec: number) => {
    await apiFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "Zona Sul", kind: "audio", audioDurationSec: durationSec, neighborhood: courier.neighborhood }),
    }).catch(() => null);
    notify(`Áudio de ${durationSec}s transmitido no canal Zona Sul (raio 5 km)`);
  };

  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    if (!gpsActive && gps.status !== "requesting") gps.start();
    if (viewMode === "brasil") setViewMode("rota");
    mapRef.current?.flyTo([posRef.current.lat, posRef.current.lng], 14, { duration: 0.8 });
  };

  const cityDistance = selectedCity ? hav(courier.baseLat, courier.baseLng, selectedCity.lat, selectedCity.lng) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0e13]">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Chip superior de navegação */}
      <div className="absolute top-3 right-3 left-3 z-[500]">
        <div className="rounded-2xl border border-white/10 bg-[#0b0e13]/88 px-3.5 py-2.5 shadow-xl backdrop-blur-md">
          {activeOrder && nextTarget ? (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <Navigation className="h-4 w-4 shrink-0 text-lime-400" />
                {nextTarget.label}: {activeOrder.status === "accepted" ? activeOrder.establishment : activeOrder.clientName}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                {fmtKm(Math.round(navKm * 10) / 10)} por ruas • ~{navMin} min • rota {deliveryRoute ? "real (OSRM)" : "estimada"} • você recebe{" "}
                <span className="text-emerald-400">{fmtBRL(activeOrder.valueNet)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <Navigation className="h-4 w-4 text-lime-400" />{" "}
                {gpsActive && gps.fix
                  ? `GPS ativo • precisão de ±${Math.round(gps.fix.accuracy)} m`
                  : `Você está em ${courier.neighborhood}, ${courier.city}/${courier.state}`}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                Raio de atuação de {courier.workRadiusKm} km • {partners.filter((p) => p.status !== "pausa").length} parceiros por perto
              </p>
            </>
          )}
        </div>

        {/* Modos de visualização + busca de cidades */}
        <div className="mt-2 flex gap-2">
          <div className="flex shrink-0 rounded-xl border border-white/10 bg-[#0b0e13]/88 p-1 shadow-xl backdrop-blur-md">
            {(
              [
                { v: "rota", l: "Minha rota" },
                { v: "brasil", l: "Brasil todo" },
              ] as { v: ViewMode; l: string }[]
            ).map((m) => (
              <button
                key={m.v}
                onClick={() => {
                  setViewMode(m.v);
                  if (m.v === "brasil") notify("Mapa do Brasil: capitais e principais cidades da rede");
                }}
                className={`rounded-lg px-3 py-2 text-[11px] font-extrabold whitespace-nowrap transition ${
                  viewMode === m.v ? "bg-lime-400 text-zinc-950" : "text-zinc-400"
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0e13]/88 px-3 shadow-xl backdrop-blur-md">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={cityQuery}
                onChange={(e) => onCityQuery(e.target.value)}
                placeholder="Buscar cidade ou capital…"
                className="h-10 w-full bg-transparent text-[13px] font-semibold text-white placeholder-zinc-500 outline-none"
              />
              {cityQuery && (
                <button onClick={clearCity} className="shrink-0 text-zinc-500" aria-label="Limpar busca">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {cityResults.length > 0 && (
              <div className="slide-up absolute top-full right-0 left-0 z-[600] mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#12151c] shadow-2xl">
                {cityResults.map((c) => (
                  <button
                    key={`${c.name}-${c.uf}`}
                    onClick={() => selectCity(c)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/5"
                  >
                    <Flag className={`h-4 w-4 shrink-0 ${c.capital ? "text-lime-400" : "text-zinc-500"}`} />
                    <span className="flex-1 text-[13px] font-bold text-white">
                      {c.name} <span className="font-semibold text-zinc-500">• {c.uf}</span>
                    </span>
                    {c.capital && <span className="rounded bg-lime-400/12 px-1.5 py-0.5 text-[9px] font-black text-lime-300">CAPITAL</span>}
                    <span className="text-[11px] font-semibold text-zinc-500 tabular-nums">
                      {fmtKm(Math.round(hav(courier.baseLat, courier.baseLng, c.lat, c.lng)))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controles laterais */}
      <div className="absolute top-[138px] right-3 z-[500] flex flex-col gap-2">
        <button
          onClick={() => setRadarOn((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-[11px] font-bold shadow-xl backdrop-blur-md transition ${
            radarOn ? "border-sky-400/40 bg-sky-400/15 text-sky-200" : "border-white/10 bg-[#0b0e13]/85 text-zinc-400"
          }`}
        >
          <Users className="h-4 w-4" /> Radar {radarOn ? "ON" : "OFF"}
        </button>
        <button
          onClick={recenter}
          className={`flex items-center justify-center rounded-xl border p-2.5 shadow-xl backdrop-blur-md ${
            gpsActive && following ? "border-sky-400/50 bg-sky-400/20 text-sky-200" : "border-white/10 bg-[#0b0e13]/85 text-zinc-200"
          }`}
          aria-label="Centralizar e seguir minha posição"
        >
          {gpsActive ? <LocateFixed className="h-5 w-5" /> : <LocateOff className="h-5 w-5" />}
        </button>
      </div>

      {/* Aviso de GPS desligado (o app segue em modo simulado) */}
      {!gpsActive && viewMode === "rota" && (
        <div className="absolute top-[138px] left-3 z-[500] max-w-[62%] rounded-xl border border-amber-400/40 bg-[#0b0e13]/92 px-3 py-2 shadow-xl backdrop-blur-md">
          <p className="text-[11px] leading-snug font-bold text-amber-200">
            {gps.status === "requesting"
              ? "Procurando sinal de GPS…"
              : gps.status === "denied"
                ? "Localização bloqueada. Libere nas configurações do navegador."
                : gps.status === "unsupported"
                  ? "Este aparelho não tem GPS disponível."
                  : gps.status === "unavailable"
                    ? "Sem sinal de GPS. Posição simulada."
                    : "GPS desligado. Posição simulada."}
          </p>
          {gps.status !== "requesting" && gps.status !== "unsupported" && (
            <button
              onClick={() => gps.start()}
              className="mt-1.5 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-black text-zinc-950 active:scale-95"
            >
              Ativar GPS
            </button>
          )}
        </div>
      )}

      {/* Legenda das regiões do Brasil */}
      {viewMode === "brasil" && !selectedCity && !hintDismissed && (
        <div className="absolute right-3 bottom-[218px] left-3 z-[500] rounded-2xl border border-white/12 bg-[#0b0e13]/92 px-3.5 py-3 shadow-xl backdrop-blur-md lg:right-auto lg:w-[300px]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-black tracking-widest text-white uppercase">
              <Flag className="h-4 w-4 text-lime-400" /> Regiões do Brasil
            </p>
            <button onClick={() => setHintDismissed(true)} className="text-zinc-500" aria-label="Fechar legenda">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {Object.entries(REGION_COLORS).map(([region, color]) => (
              <span key={region} className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: color }} />
                {region}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            27 estados + DF e as capitais da rede. Toque em um estado ou capital para identificar.
          </p>
        </div>
      )}

      {/* Cartão da cidade selecionada */}
      {selectedCity && (
        <div className="slide-up absolute right-3 bottom-[218px] left-3 z-[500] rounded-2xl border border-white/12 bg-[#0d1015]/92 p-3.5 shadow-2xl backdrop-blur-md lg:right-auto lg:w-[380px]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-white">
                {selectedCity.name} — {selectedCity.uf}
                {selectedCity.capital && <span className="ml-2 rounded bg-lime-400/15 px-1.5 py-0.5 align-middle text-[9px] font-black text-lime-300">CAPITAL</span>}
              </p>
              <p className="text-[11px] font-semibold text-zinc-400">
                {fmtKm(Math.round(cityDistance))} da sua base em {courier.neighborhood} • lat {selectedCity.lat.toFixed(3)}, lng {selectedCity.lng.toFixed(3)}
              </p>
            </div>
            <button onClick={clearCity} className="rounded-lg bg-white/5 p-1.5 text-zinc-400" aria-label="Fechar cidade">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${courier.baseLat},${courier.baseLng}&destination=${selectedCity.lat},${selectedCity.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/8 text-xs font-extrabold text-white transition active:scale-95"
            >
              <ExternalLink className="h-4 w-4 text-lime-300" /> Google Maps
            </a>
            <a
              href={`https://waze.com/ul?ll=${selectedCity.lat},${selectedCity.lng}&navigate=yes`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white/8 text-xs font-extrabold text-white transition active:scale-95"
            >
              <Navigation className="h-4 w-4 text-sky-300" /> Waze
            </a>
          </div>
        </div>
      )}

      {/* Alertas rápidos de 1 toque */}
      <div className="absolute right-0 bottom-36 left-0 z-[500] px-3">
        <p className="mb-1.5 pl-1 text-[10px] font-bold tracking-widest text-zinc-400 uppercase [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
          Alertar a rede (1 toque)
        </p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {ALERTS.map((a) => (
            <button
              key={a.type}
              onClick={() => sendAlert(a.type)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-extrabold shadow-lg backdrop-blur-md transition active:scale-95 ${a.classes} ${a.type === "sos" ? "animate-pulse" : ""}`}
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* PTT flutuante */}
      <div className="absolute right-3 bottom-24 z-[500]">
        <PttButton onSend={sendPtt} size="md" label="PTT" />
      </div>

      {/* Card da entrega ativa — partida, destino e navegação externa */}
      {activeOrder && nextTarget && (
        <div className="absolute right-3 bottom-3 left-3 z-[500] rounded-3xl border border-white/10 bg-[#0d1015]/92 p-3.5 shadow-2xl backdrop-blur-md lg:left-auto lg:w-[430px]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {activeOrder.code} • {activeOrder.establishment} → {activeOrder.deliveryNeighborhood}
              </p>
              <p className="truncate text-[11px] text-zinc-400">
                Partida: {activeOrder.pickupAddress} • Destino: {activeOrder.deliveryAddress}
              </p>
            </div>
            <span className="shrink-0 font-display text-lg font-black text-emerald-400">{fmtBRL(activeOrder.valueNet)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={navGoogle}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/6 text-xs font-extrabold text-white transition active:scale-95"
            >
              <ExternalLink className="h-4 w-4 text-lime-300" /> Navegar: Maps
            </a>
            <a
              href={navWaze}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/6 text-xs font-extrabold text-white transition active:scale-95"
            >
              <Navigation className="h-4 w-4 text-sky-300" /> Navegar: Waze
            </a>
          </div>
          <button
            disabled={busy}
            onClick={async () => {
              // Longe do ponto: pede um segundo toque para confirmar
              if (farFromTarget && !confirmArmed) {
                setConfirmArmed(true);
                notify(`Você está a ${distLabel} do ${activeOrder.status === "accepted" ? "ponto de coleta" : "destino"}. Toque de novo para confirmar mesmo assim.`, "warn");
                if (navigator.vibrate) navigator.vibrate(80);
                return;
              }
              setBusy(true);
              await onOrderAction(activeOrder, activeOrder.status === "accepted" ? "pickup" : "deliver");
              setBusy(false);
              setConfirmArmed(false);
            }}
            className={`mt-2.5 h-13 w-full rounded-2xl py-3.5 text-sm font-black tracking-wide text-zinc-950 transition active:scale-[0.98] disabled:opacity-50 ${
              activeOrder.status === "accepted" ? "bg-amber-400" : "bg-emerald-400"
            }`}
          >
            {farFromTarget && confirmArmed
              ? `CONFIRMAR MESMO ASSIM (${distLabel})`
              : activeOrder.status === "accepted"
                ? "CONFIRMAR COLETA NA PARTIDA"
                : "CONFIRMAR ENTREGA NO DESTINO"}
          </button>
        </div>
      )}
    </div>
  );
}
