"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./session";

export type PushState =
  | "loading"
  | "unsupported" // navegador sem push
  | "ios-install" // iPhone: precisa instalar na tela de início primeiro
  | "denied" // usuário bloqueou notificações
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Sino de notificações: liga/desliga o aviso de corridas novas neste aparelho */
export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    nav.brave?.isBrave?.().then((b) => setIsBrave(!!b)).catch(() => null);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIOS && !standalone ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Precisa ser chamado num toque do usuário (exigência dos navegadores) */
  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return "Permissão de notificação não concedida.";
      }
      const reg = await registration();
      const { publicKey } = await (await apiFetch("/api/push/key")).json();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      }
      const res = await apiFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("falha ao salvar");
      setState("on");
      return null;
    } catch {
      await refresh();
      return isBrave
        ? "O Brave bloqueou as notificações. Abra o RotaLivre no Google Chrome para receber os avisos."
        : "Não foi possível ligar as notificações neste aparelho. Tente pelo Google Chrome.";
    } finally {
      setBusy(false);
    }
  }, [refresh, isBrave]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => null);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    await apiFetch("/api/push/test", { method: "POST" });
  }, []);

  return { state, busy, isBrave, enable, disable, sendTest };
}
