"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Map as MapIcon, Radio, User, Wallet } from "lucide-react";
import type { Courier, CourierStatus, DashboardData, Order } from "@/lib/types";
import { fmtBRL, initialsOf } from "@/lib/format";
import { apiFetch, clearSession, getSessionId, setSessionId } from "@/lib/session";
import Header from "./Header";
import HomeView from "./HomeView";
import MapView from "./MapView";
import { useGeolocation } from "@/lib/useGeolocation";
import RadioView from "./RadioView";
import ReportsView from "./ReportsView";
import ProfileView from "./ProfileView";
import AuthScreen from "./AuthScreen";
import { InstallButton } from "./InstallApp";

type Tab = "inicio" | "mapa" | "radio" | "relatorios" | "perfil";
type Tone = "ok" | "warn" | "sos";
type Screen = "checking" | "auth" | "app";

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "inicio", label: "Início", icon: LayoutDashboard },
  { id: "mapa", label: "Mapa", icon: MapIcon },
  { id: "radio", label: "Rádio", icon: Radio },
  { id: "relatorios", label: "Relatórios", icon: Wallet },
  { id: "perfil", label: "Perfil", icon: User },
];

export default function AppShell() {
  const [screen, setScreen] = useState<Screen>("checking");
  // GPS real ligado no app inteiro: o feed e o radar usam a posição atual
  const gps = useGeolocation();
  const [tab, setTab] = useState<Tab>("inicio");
  const [courier, setCourier] = useState<Courier | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: Tone; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, tone: Tone = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, tone, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const loadCourier = useCallback(async () => {
    const res = await apiFetch("/api/courier");
    const data = await res.json();
    if (data.courier) setCourier(data.courier);
    return data.courier as Courier | undefined;
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard");
      const data = await res.json();
      setDashboard(data);
    } catch { /* mantém último estado */ }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCourier(), loadDashboard()]);
  }, [loadCourier, loadDashboard]);

  /* Service Worker (PWA) + restauração de sessão */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }
    (async () => {
      if (getSessionId()) {
        const c = await loadCourier().catch(() => undefined);
        if (c) {
          await loadDashboard();
          setScreen("app");
          return;
        }
        clearSession();
      }
      setScreen("auth");
    })();
  }, [loadCourier, loadDashboard]);

  useEffect(() => {
    if (screen !== "app") return;
    const t = setInterval(loadDashboard, 15000);
    return () => clearInterval(t);
  }, [screen, loadDashboard]);

  const handleAuthenticated = async (c: Courier) => {
    setSessionId(c.id);
    setCourier(c);
    setTab("inicio");
    setScreen("app");
    await loadDashboard();
    notify(`Bem-vindo(a), ${c.nickname || c.name.split(" ")[0]}! Você já está online na praça.`);
  };

  const handleLogout = () => {
    clearSession();
    setCourier(null);
    setDashboard(null);
    setTab("inicio");
    setScreen("auth");
  };

  const handleStatusChange = async (status: CourierStatus) => {
    if (!courier) return;
    setCourier({ ...courier, status });
    await apiFetch("/api/courier", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    notify(status === "online" ? "Você está online e visível no feed" : status === "pausa" ? "Pausa ativada — descanse, sem punições" : "Você ficou offline");
  };

  /** Ações da corrida ativa compartilhadas entre Início e Mapa */
  const handleOrderAction = useCallback(
    async (order: Order, action: "pickup" | "deliver") => {
      try {
        const res = await apiFetch(`/api/orders/${order.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify(data.error ?? "Algo deu errado", "warn");
          return;
        }
        if (action === "pickup") notify("Coleta confirmada. Rota até o cliente no mapa!");
        if (action === "deliver") {
          notify(`Entrega concluída! +${fmtBRL(data.earned)} no seu saldo`);
          if (data.tip) setTimeout(() => notify(`Gorjeta recebida: +${fmtBRL(data.tip)}`), 700);
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        }
        await refreshAll();
      } catch {
        notify("Falha de conexão. Tente de novo.", "warn");
      }
    },
    [notify, refreshAll],
  );

  if (screen === "checking") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#05070a]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="RotaLivre" className="h-16 w-16 rounded-3xl" />
        <p className="font-display text-2xl font-black tracking-tight text-white">
          Rota<span className="text-lime-400">Livre</span>
        </p>
        <p className="animate-pulse text-sm text-zinc-500">Conectando à praça…</p>
      </div>
    );
  }

  if (screen === "auth" || !courier) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-dvh bg-[#030405]">
      {/* ---------- Sidebar (notebook/desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/6 bg-[#07090d] lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="RotaLivre" className="h-11 w-11 shrink-0 rounded-2xl" />
          <div>
            <p className="font-display text-lg leading-none font-black text-white">
              Rota<span className="text-lime-400">Livre</span>
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Hub do entregador</p>
          </div>
        </div>

        <nav className="space-y-1 px-3">
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
                  active ? "bg-lime-400/12 text-lime-300" : "text-zinc-400 hover:bg-white/4 hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.id === "radio" && <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />}
                {item.id === "mapa" && dashboard?.activeOrder && (
                  <span className="ml-auto rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black text-amber-300">1 ativa</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-4">
          <InstallButton className="h-12 w-full text-sm" />
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 p-3">
            {courier.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={courier.photoUrl} alt={courier.name} className="h-10 w-10 rounded-xl object-cover ring-1 ring-lime-400/50" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500 text-xs font-black text-zinc-950">
                {initialsOf(courier.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">
                {courier.name.split(" ")[0]} “{courier.nickname}”
              </p>
              <p className="truncate text-[11px] text-emerald-400">{fmtBRL(dashboard?.todayNet ?? 0)} hoje</p>
            </div>
            <button onClick={handleLogout} className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-red-300" aria-label="Sair da conta" title="Sair da conta">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Coluna principal ---------- */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[#05070a] shadow-[0_0_80px_rgba(0,0,0,0.9)] md:border-x md:border-white/6 lg:mx-0 lg:ml-64 lg:max-w-none lg:border-none lg:shadow-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Header
          courier={courier}
          todayNet={dashboard?.todayNet ?? 0}
          onStatusChange={handleStatusChange}
          onOpenProfile={() => setTab("perfil")}
          notify={notify}
        />

        <main className="relative min-h-0 flex-1">
          {tab === "inicio" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <HomeView dashboard={dashboard} refreshDashboard={refreshAll} notify={notify} goToMap={() => setTab("mapa")} />
            </div>
          )}
          {tab === "mapa" && (
            // absolute inset-0: o mapa ocupa toda a área do <main> (h-full dava altura 0 no celular)
            <div className="absolute inset-0 pb-[68px] lg:pb-0">
              <MapView courier={courier} activeOrder={dashboard?.activeOrder ?? null} notify={notify} onOrderAction={handleOrderAction} gps={gps} />
            </div>
          )}
          {tab === "radio" && (
            <div className="h-full pb-[68px] lg:pb-0">
              <RadioView courier={courier} notify={notify} />
            </div>
          )}
          {tab === "relatorios" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <ReportsView notify={notify} />
            </div>
          )}
          {tab === "perfil" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <ProfileView courier={courier} onSaved={(c) => { setCourier(c); refreshAll(); }} onLogout={handleLogout} notify={notify} />
            </div>
          )}
        </main>

        {/* Toast global */}
        {toast && (
          <div key={toast.key} className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4 lg:left-auto lg:right-6 lg:justify-end"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <div
              className={`toast-in w-full max-w-[440px] rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-md ${
                toast.tone === "sos"
                  ? "animate-pulse border-red-500/60 bg-red-950/90 text-red-100"
                  : toast.tone === "warn"
                    ? "border-amber-400/40 bg-[#1d1608]/92 text-amber-100"
                    : "border-lime-400/30 bg-[#0e1407]/92 text-lime-100"
              }`}
            >
              {toast.msg}
            </div>
          </div>
        )}

        {/* Navegação inferior (celular) */}
        <nav
          className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-white/8 bg-[#07090d]/94 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-5">
            {NAV.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
                    active ? "text-lime-300" : "text-zinc-500"
                  }`}
                >
                  {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-lime-400" />}
                  <item.icon className={`h-6 w-6 ${active ? "stroke-[2.4]" : ""}`} />
                  {item.label}
                  {item.id === "radio" && <span className="absolute top-2 right-[22%] h-2 w-2 rounded-full bg-red-500" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
