"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./session";

export type GpsStatus =
  | "idle" // ainda não pedimos
  | "requesting" // aguardando o usuário permitir / primeira leitura
  | "active" // recebendo posições
  | "denied" // usuário negou a permissão
  | "unavailable" // sem GPS / sem HTTPS / sinal perdido
  | "unsupported"; // navegador sem geolocalização

export interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number; // metros
  heading: number | null; // graus (0 = norte)
  speedKmh: number | null;
  timestamp: number;
}

const SEND_EVERY_MS = 15_000;
const SEND_EVERY_M = 30;
const GRANTED_KEY = "rl_gps_granted";

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * GPS real do celular (navigator.geolocation.watchPosition).
 * - Envia a posição ao servidor com limite de frequência (15 s ou 30 m).
 * - Liga automaticamente se o usuário já tinha permitido antes.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [fix, setFix] = useState<GpsFix | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<{ lat: number; lng: number; t: number } | null>(null);

  const send = useCallback((f: GpsFix) => {
    const prev = lastSent.current;
    const now = Date.now();
    if (prev && now - prev.t < SEND_EVERY_MS && distM(prev, f) < SEND_EVERY_M) return;
    lastSent.current = { lat: f.lat, lng: f.lng, t: now };
    apiFetch("/api/courier/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: f.lat, lng: f.lng, accuracy: f.accuracy, heading: f.heading, speedKmh: f.speedKmh }),
      keepalive: true,
    }).catch(() => null);
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    if (!window.isSecureContext) {
      setStatus("unavailable");
      return;
    }
    stop();
    setStatus((s) => (s === "active" ? s : "requesting"));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const f: GpsFix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          speedKmh: p.coords.speed != null && !Number.isNaN(p.coords.speed) ? p.coords.speed * 3.6 : null,
          timestamp: p.timestamp,
        };
        setFix(f);
        setStatus("active");
        try {
          localStorage.setItem(GRANTED_KEY, "1");
        } catch { /* ignore */ }
        send(f);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          try {
            localStorage.removeItem(GRANTED_KEY);
          } catch { /* ignore */ }
          stop();
        } else {
          // TIMEOUT / POSITION_UNAVAILABLE: mantém o watch tentando
          setStatus((s) => (s === "active" ? s : "unavailable"));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [send, stop]);

  // Religa sozinho se a permissão já foi dada antes
  useEffect(() => {
    let granted = false;
    try {
      granted = localStorage.getItem(GRANTED_KEY) === "1";
    } catch { /* ignore */ }
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((r) => {
          if (r.state === "granted" || (granted && r.state !== "denied")) start();
          else if (r.state === "denied") setStatus("denied");
        })
        .catch(() => {
          if (granted) start();
        });
    } else if (granted) {
      start();
    }
    return stop;
  }, [start, stop]);

  return { status, fix, start, stop };
}

/** Mantém a tela acesa enquanto `active` for true (Screen Wake Lock API). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock!
        .request("screen")
        .then((l) => {
          if (cancelled) l.release().catch(() => null);
          else lock = l;
        })
        .catch(() => null);
    };
    acquire();
    // O sistema solta o lock quando o app vai para segundo plano: pede de novo ao voltar
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => null);
    };
  }, [active]);
}
