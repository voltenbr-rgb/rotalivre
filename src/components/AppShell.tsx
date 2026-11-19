"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Map as MapIcon, Radio, User, Wallet } from "lucide-react";
import type { Courier, CourierStatus, DashboardData, Order, Store } from "@/lib/types";
import { fmtBRL, initialsOf } from "@/lib/format";
import { apiFetch, clearSession, getRole, getToken, setRole, setToken } from "@/lib/session";
import Header from "./Header";
import HomeView from "./HomeView";
import MapView from "./MapView";
import Onboarding, { markOnboardingSeen, onboardingSeen } from "./Onboarding";
import { useGeolocation } from "@/lib/useGeolocation";
import RadioView from "./RadioView";
import ReportsView from "./ReportsView";
import ProfileView from "./ProfileView";
import RoleGate from "./RoleGate";
import StoreApp from "./StoreApp";
import AdminPanel from "./AdminPanel";
import { InstallButton } from "./InstallApp";

type Tab = "inicio" | "mapa" | "radio" | "relatorios" | "perfil";
type Tone = "ok" | "warn" | "sos";
type Screen = "checking" | "auth" | "app" | "store" | "admin";

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
  // Tutorial de primeiro acesso (por conta, neste aparelho)
  const [showTutorial, setShowTutorial] = useState(false);

  /* ---------- Código de entrega (pedidos de loja) ---------- */
  const [codeAsk, setCodeAsk] = useState<{ order: Order; error?: string; resolve: (c: string | null) => void } | null>(null);
  const askDeliveryCode = useCallback(
    (order: Order, error?: string) => new Promise<string | null>((resolve) => setCodeAsk({ order, error, resolve })),
    [],
  );

  /* ---------- Botão "voltar" do celular ---------- */
  // Em vez de fechar o app: volta para o Início; no Início, pergunta se quer sair.
  const [exitAsk, setExitAsk] = useState(false);
  const backState = useRef({ tab: "inicio", screen: "checking" as string, exitAsk: false });
  const [tab, setTab] = useState<Tab>("inicio");
  const [courier, setCourier] = useState<Courier | null>(null);
  // Conta de loja (quando o perfil deste aparelho é "lojista")
  const [store, setStore] = useState<Store | null>(null);
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
      const role = getRole();
      if (getToken() && role === "store") {
        const res = await apiFetch("/api/store/me").catch(() => null);
        if (res?.ok) {
          setStore((await res.json()).store);
          setScreen("store");
          return;
        }
        clearSession();
      } else if (getToken() && role === "admin") {
        const res = await apiFetch("/api/admin/overview").catch(() => null);
        if (res?.ok) {
          setScreen("admin");
          return;
        }
        clearSession();
      } else if (getToken()) {
        const c = await loadCourier().catch(() => undefined);
        if (c) {
          await loadDashboard();
          setScreen("app");
          if (!onboardingSeen(c.id)) setShowTutorial(true);
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

  // Mantém o estado atual acessível para o "voltar" (o listener é registrado uma vez)
  useEffect(() => {
    backState.current = { tab, screen, exitAsk };
  });

  useEffect(() => {
    // Uma "página extra" no histórico segura o primeiro voltar dentro do app
    const guard = () => history.pushState({ rlGuard: true }, "");
    guard();
    const onPop = () => {
      const st = backState.current;
      if (st.exitAsk) {
        // Já perguntou e a pessoa apertou voltar de novo: deixa sair
        setExitAsk(false);
        return;
      }
      if (st.screen === "app" && st.tab !== "inicio") {
        setTab("inicio");
        guard();
        return;
      }
      setExitAsk(true);
      guard();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleAuthenticated = async (c: Courier, token: string) => {
    setToken(token);
    setRole("courier");
    setCourier(c);
    setTab("inicio");
    setScreen("app");
    if (!onboardingSeen(c.id)) setShowTutorial(true);
    await loadDashboard();
    notify(`Bem-vindo(a), ${c.nickname || c.name.split(" ")[0]}! Você já está online na praça.`);
  };

  const handleStoreAuthenticated = (st: Store, token: string) => {
    setToken(token);
    setRole("store");
    setStore(st);
    setScreen("store");
  };

  const handleAdminAuthenticated = (token: string) => {
    setToken(token);
    setRole("admin");
    setScreen("admin");
  };

  /** Sai da conta de loja ou do painel master */
  const handleOtherLogout = useCallback(() => {
    const url = getRole() === "store" ? "/api/store/auth" : "/api/admin/login";
    apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => null);
    setTimeout(clearSession, 300);
    setStore(null);
    setScreen("auth");
  }, []);

  const handleLogout = () => {
    // Invalida a chave no servidor (este aparelho sai da conta)
    apiFetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => null);
    setTimeout(clearSession, 300);
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
        let code: string | null = null;
        let codeError: string | undefined;
        let data = {} as { error?: string; earned: number; tip?: number | null; needsCode?: boolean; attemptsLeft?: number };
        for (;;) {
          if (action === "deliver" && order.needsCode) {
            code = await askDeliveryCode(order, codeError);
            if (!code) return;
          }
          const res = await apiFetch(`/api/orders/${order.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, code }),
          });
          data = await res.json();
          if (res.ok) break;
          if (action === "deliver" && data.needsCode && (data.attemptsLeft ?? 0) > 0) {
            codeError = data.error;
            continue;
          }
          notify(data.error ?? "Algo deu errado", "warn");
          return;
        }
        if (action === "pickup") notify("Coleta confirmada. Rota até o cliente no mapa!");
        if (action === "deliver") {
          notify(`Entrega concluída! +${fmtBRL(data.earned)} no seu saldo`);
          const tip = data.tip;
          if (tip) setTimeout(() => notify(`Gorjeta recebida: +${fmtBRL(tip)}`), 700);
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        }
        await refreshAll();
      } catch {
        notify("Falha de conexão. Tente de novo.", "warn");
      }
    },
    [notify, refreshAll, askDeliveryCode],
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

  const exitView = exitAsk && (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/75 p-6" onClick={() => setExitAsk(false)}>
      <div onClick={(e) => e.stopPropagation()} className="slide-up w-full max-w-[320px] rounded-3xl border border-white/10 bg-[#0d1015] p-5 shadow-2xl">
        <p className="font-display text-lg font-extrabold text-white">Deseja sair do RotaLivre?</p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-400">Você continua logado e pode voltar quando quiser.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setExitAsk(false)} className="h-12 flex-1 rounded-2xl bg-lime-400 text-sm font-black text-zinc-950">
            FICAR
          </button>
          <button
            onClick={() => {
              // Tira a "página extra" e volta: no app instalado isso fecha
              backState.current.exitAsk = true;
              history.go(-2);
              setTimeout(() => setExitAsk(false), 400);
            }}
            className="h-12 flex-1 rounded-2xl border border-white/12 bg-white/5 text-sm font-bold text-zinc-200"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  const codeView = codeAsk && (
    <DeliveryCodeDialog
      key={codeAsk.order.id + (codeAsk.error ?? "")}
      order={codeAsk.order}
      error={codeAsk.error}
      onDone={(c) => {
        codeAsk.resolve(c);
        setCodeAsk(null);
      }}
    />
  );

  const toastView = toast && (
    <div
      key={toast.key}
      className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <div
        className={`toast-in w-full max-w-[440px] rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-md ${
          toast.tone === "warn" ? "border-amber-400/40 bg-[#1d1608]/92 text-amber-100" : "border-lime-400/30 bg-[#0e1407]/92 text-lime-100"
        }`}
      >
        {toast.msg}
      </div>
    </div>
  );

  if (screen === "store" && store) {
    return (
      <>
        <StoreApp store={store} onStoreChange={setStore} onLogout={handleOtherLogout} notify={notify} />
        {toastView}
        {exitView}
      </>
    );
  }

  if (screen === "admin") {
    return (
      <>
        <AdminPanel onLogout={handleOtherLogout} />
        {exitView}
      </>
    );
  }

  if (screen === "auth" || !courier) {
    return (
      <>
        <RoleGate onCourier={handleAuthenticated} onStore={handleStoreAuthenticated} onAdmin={handleAdminAuthenticated} />
        {toastView}
        {exitView}
      </>
    );
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
        {/* No mapa e no rádio o cabeçalho some: a tela fica para o conteúdo */}
        {tab !== "mapa" && tab !== "radio" && (
          <Header
            courier={courier}
            todayNet={dashboard?.todayNet ?? 0}
            onStatusChange={handleStatusChange}
            onOpenProfile={() => setTab("perfil")}
            notify={notify}
          />
        )}

        <main className="relative min-h-0 flex-1">
          {tab === "inicio" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <HomeView dashboard={dashboard} refreshDashboard={refreshAll} notify={notify} goToMap={() => setTab("mapa")} askDeliveryCode={askDeliveryCode} />
            </div>
          )}
          {tab === "mapa" && (
            // absolute inset-0: o mapa ocupa toda a área do <main> (h-full dava altura 0 no celular)
            <div className="absolute inset-0 pb-[68px] lg:pb-0">
              <MapView courier={courier} activeOrder={dashboard?.activeOrder ?? null} notify={notify} onOrderAction={handleOrderAction} gps={gps} />
            </div>
          )}
          {tab === "radio" && (
            <div className="absolute inset-0 pb-[68px] lg:pb-0">
              <RadioView courier={courier} notify={notify} onStatusChange={handleStatusChange} />
            </div>
          )}
          {tab === "relatorios" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <ReportsView notify={notify} />
            </div>
          )}
          {tab === "perfil" && (
            <div className="no-scrollbar h-full overflow-y-auto pb-24 lg:pb-10">
              <ProfileView courier={courier} onSaved={(c) => { setCourier(c); refreshAll(); }} onLogout={handleLogout} notify={notify} onOpenTutorial={() => setShowTutorial(true)} />
            </div>
          )}
        </main>

        {codeView}
        {exitView}

        {showTutorial && (
          <Onboarding
            name={courier.nickname || courier.name.split(" ")[0]}
            onClose={() => {
              markOnboardingSeen(courier.id);
              setShowTutorial(false);
            }}
          />
        )}

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

/** Janela para digitar o código de 4 dígitos que o cliente recebeu da loja */
function DeliveryCodeDialog({ order, error, onDone }: { order: Order; error?: string; onDone: (code: string | null) => void }) {
  const [code, setCode] = useState("");
  const ok = code.length === 4;
  return (
    <div className="fixed inset-0 z-[97] flex items-end justify-center bg-black/80 sm:items-center" onClick={() => onDone(null)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up w-full max-w-[400px] rounded-t-3xl border border-white/10 bg-[#0d1015] p-6 sm:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <p className="font-display text-xl font-black text-white">Código de entrega</p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-400">
          Peça ao cliente <b className="text-white">{order.clientName}</b> o código de 4 dígitos que ele recebeu da loja{" "}
          <b className="text-white">{order.establishment}</b>.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && ok && onDone(code)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••"
          className="mt-4 h-16 w-full rounded-2xl border border-white/12 bg-white/5 text-center font-display text-4xl font-black tracking-[0.6em] text-white outline-none focus:border-lime-400/70"
        />
        {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={() => onDone(null)} className="h-13 rounded-2xl border border-white/12 bg-white/5 px-5 py-3.5 text-sm font-bold text-zinc-300">
            Cancelar
          </button>
          <button
            disabled={!ok}
            onClick={() => onDone(code)}
            className="h-13 flex-1 rounded-2xl bg-lime-400 py-3.5 text-sm font-black text-zinc-950 disabled:opacity-40"
          >
            CONFIRMAR ENTREGA
          </button>
        </div>
      </div>
    </div>
  );
}
