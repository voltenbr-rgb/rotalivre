"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bike, CircleCheckBig, Flame, Gauge, Map as MapIcon, Navigation,
  PackageCheck, Target, Timer, Users,
} from "lucide-react";
import type { DashboardData, Order } from "@/lib/types";
import { fmtBRL, fmtKm } from "@/lib/format";
import OrderCard from "./OrderCard";
import { apiFetch } from "@/lib/session";
import { InstallBanner } from "./InstallApp";

interface Props {
  dashboard: DashboardData | null;
  refreshDashboard: () => Promise<void>;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
  goToMap: () => void;
  /** Abre a janela do código de 4 dígitos (pedidos de loja) */
  askDeliveryCode: (order: Order, error?: string) => Promise<string | null>;
}

/**
 * Pedidos ignorados ficam escondidos só neste aparelho (não somem para os outros).
 * A chave é pedido + valor: se a loja aumentar o valor ou relançar, ele reaparece.
 */
const DISMISSED_KEY = "rl_dismissed_v2";
const dismissKey = (o: Order) => `${o.id}:${o.valueNet}`;
function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-200)));
  } catch { /* ignore */ }
}

type SortMode = "valor" | "taxa" | "distancia";

export default function HomeView({ dashboard, refreshDashboard, notify, goToMap, askDeliveryCode }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sort, setSort] = useState<SortMode>("valor");
  const [acting, setActing] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiFetch("/api/orders");
      const data = await res.json();
      const dismissed = loadDismissed();
      const list: Order[] = (data.orders ?? []).filter((o: Order) => !dismissed.has(dismissKey(o)));
      if (!firstLoad.current) {
        const fresh = list.filter((o) => !knownIds.current.has(dismissKey(o)));
        if (fresh.length > 0) notify(`Nova corrida na praça: ${fresh[0].establishment} • ${fmtBRL(fresh[0].valueNet)}`);
      }
      firstLoad.current = false;
      knownIds.current = new Set(list.map((o) => dismissKey(o)));
      setOrders(list);
    } catch {
      /* rede instável: mantém o feed atual */
    }
  }, [notify]);

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 7000);
    return () => clearInterval(t);
  }, [loadOrders]);

  const sorted = useMemo(() => {
    const arr = [...orders];
    if (sort === "valor") arr.sort((a, b) => b.valueNet - a.valueNet);
    if (sort === "taxa") arr.sort((a, b) => b.ratePerKm - a.ratePerKm);
    if (sort === "distancia") arr.sort((a, b) => a.distanceKm - b.distanceKm);
    return arr;
  }, [orders, sort]);

  const act = async (order: Order, action: "accept" | "pickup" | "deliver" | "dismiss") => {
    if (action === "dismiss") {
      const ids = loadDismissed();
      ids.add(dismissKey(order));
      saveDismissed(ids);
    }
    // Pedido de loja: pede o código que o cliente recebeu
    let code: string | null = null;
    let codeError: string | undefined;
    setActing(true);
    try {
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
        const data = await res.json();
        if (!res.ok) {
          // Código errado: abre a janela de novo mostrando o erro
          if (action === "deliver" && data.needsCode && data.attemptsLeft > 0) {
            codeError = data.error;
            continue;
          }
          notify(data.error ?? "Algo deu errado", "warn");
          if (action === "accept") loadOrders();
          return;
        }
        await afterAction(order, action, data);
        return;
      }
    } finally {
      setActing(false);
    }
  };

  const [cancelOpen, setCancelOpen] = useState(false);

  const cancelRide = async (order: Order, reason: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/api/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error ?? "Não foi possível cancelar", "warn");
        return;
      }
      // A corrida volta para o feed de todos (inclusive o seu)
      setCancelOpen(false);
      notify(`Corrida cancelada. Sua nota agora é ${Number(data.rating).toFixed(1)}`, "warn");
      await refreshDashboard();
      loadOrders();
    } finally {
      setActing(false);
    }
  };

  const afterAction = async (order: Order, action: "accept" | "pickup" | "deliver" | "dismiss", data: { earned?: number; tip?: number | null }) => {
    {
      if (action === "accept") {
        notify(`Corrida ${order.code} aceita! Abrindo a rota: partida e destino no mapa`);
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
        await refreshDashboard();
        goToMap();
        return;
      }
      if (action === "pickup") notify("Coleta confirmada. Boa entrega!");
      if (action === "deliver") {
        notify(`Entrega concluída! +${fmtBRL(data.earned ?? 0)} no seu saldo`);
        if (data.tip) setTimeout(() => notify(`Gorjeta recebida: +${fmtBRL(data.tip!)}`), 600);
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      }
      if (action === "dismiss") setOrders((prev) => prev.filter((o) => o.id !== order.id));
      await refreshDashboard();
      loadOrders();
    }
  };

  const d = dashboard;
  const active = d?.activeOrder ?? null;

  return (
    <div className="mx-auto w-full max-w-[520px] space-y-5 px-4 pt-4 lg:max-w-5xl lg:px-6">
      <InstallBanner />
      {/* ---------- Dashboard operacional ---------- */}
      <section className="overflow-hidden rounded-3xl border border-white/8 bg-[#101319] p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
            <Target className="h-4 w-4 text-lime-400" /> Meta do dia
          </p>
          <span className="text-xs font-bold text-zinc-400 tabular-nums">
            {fmtBRL(d?.todayNet ?? 0)} <span className="text-zinc-600">/ {fmtBRL(d?.goal ?? 250)}</span>
          </span>
        </div>
        <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-lime-400 transition-all duration-700"
            style={{ width: `${d?.goalPercent ?? 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-[11px] font-bold text-lime-300">{d?.goalPercent ?? 0}% da meta</p>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <Stat icon={<PackageCheck className="h-4 w-4 text-emerald-300" />} label="Entregas" value={String(d?.deliveriesToday ?? 0)} />
          <Stat icon={<Gauge className="h-4 w-4 text-sky-300" />} label="Média/hora" value={fmtBRL(d?.hourlyAverage ?? 0)} small />
          <Stat icon={<Navigation className="h-4 w-4 text-amber-300" />} label="Km hoje" value={fmtKm(d?.kmToday ?? 0)} small />
          <Stat icon={<Users className="h-4 w-4 text-teal-300" />} label="Na rede" value={String(d?.onlinePartners ?? 0)} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Timer className="h-3.5 w-3.5" />
          {d?.hoursOnline ?? 0}h online hoje • ganhos atualizam em tempo real a cada entrega
        </p>
      </section>

      {/* ---------- Entrega ativa ---------- */}
      {active && (
        <section className="slide-up overflow-hidden rounded-3xl border border-amber-400/25 bg-[#171208] p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-black tracking-widest text-amber-300 uppercase">
              <Bike className="h-4 w-4" /> Entrega em andamento {active.code}
            </p>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-200">
              {active.status === "accepted" ? "Ir à coleta" : "A caminho do cliente"}
            </span>
          </div>
          <p className="mt-2 text-[15px] font-bold text-white">
            {active.establishment} <span className="font-medium text-zinc-400">→ {active.clientName}</span>
          </p>
          <p className="text-xs text-zinc-400">
            {active.pickupNeighborhood} → {active.deliveryNeighborhood} • {fmtKm(active.distanceKm)} • você recebe{" "}
            <span className="font-bold text-emerald-400">{fmtBRL(active.valueNet)}</span>
          </p>

          <div className="mt-3 flex items-center gap-2">
            {["Aceita", "Coletada", "Entregue"].map((step, i) => {
              const done = active.status === "picked_up" ? i <= 1 : i === 0;
              return (
                <div key={step} className="flex flex-1 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${done ? "bg-lime-400 text-zinc-950" : "bg-zinc-800 text-zinc-500"}`}>
                    {done ? <CircleCheckBig className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={`text-[11px] font-bold ${done ? "text-lime-300" : "text-zinc-500"}`}>{step}</span>
                  {i < 2 && <span className={`h-px flex-1 ${done && active.status === "picked_up" ? "bg-lime-400/60" : "bg-zinc-800"}`} />}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={goToMap}
              className="flex h-13 items-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-sm font-bold text-white active:scale-95"
            >
              <MapIcon className="h-4 w-4" /> Mapa
            </button>
            {active.status === "accepted" ? (
              <button
                onClick={() => act(active, "pickup")}
                disabled={acting}
                className="h-13 flex-1 rounded-2xl bg-amber-400 py-3.5 text-sm font-black tracking-wide text-zinc-950 active:scale-[0.98] disabled:opacity-50"
              >
                CONFIRMAR COLETA
              </button>
            ) : (
              <button
                onClick={() => act(active, "deliver")}
                disabled={acting}
                className="h-13 flex-1 rounded-2xl bg-emerald-400 py-3.5 text-sm font-black tracking-wide text-zinc-950 shadow-[0_10px_26px_rgba(52,211,153,0.3)] active:scale-[0.98] disabled:opacity-50"
              >
                CONFIRMAR ENTREGA • {fmtBRL(active.valueNet)}
              </button>
            )}
          </div>
          <button
            onClick={() => setCancelOpen(true)}
            disabled={acting}
            className="mt-3 w-full text-center text-[12px] font-bold text-red-300/80 active:text-red-300"
          >
            Tive um imprevisto — desistir da corrida
          </button>
          {cancelOpen && (
            <CancelRideDialog
              pickedUp={active.status === "picked_up"}
              busy={acting}
              onClose={() => setCancelOpen(false)}
              onConfirm={(reason) => cancelRide(active, reason)}
            />
          )}
        </section>
      )}

      {/* ---------- Feed aberto ---------- */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-white">
            <Flame className="h-5 w-5 text-orange-400" /> Corridas na praça
          </h2>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> AO VIVO • {orders.length}
          </span>
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {(
            [
              { v: "valor", l: "Maior valor" },
              { v: "taxa", l: "Melhor R$/km" },
              { v: "distancia", l: "Mais perto" },
            ] as { v: SortMode; l: string }[]
          ).map((s) => (
            <button
              key={s.v}
              onClick={() => setSort(s.v)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                sort === s.v ? "bg-lime-400 text-zinc-950" : "border border-white/10 bg-white/4 text-zinc-400"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3.5 pb-2 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              disabled={acting || !!active}
              onAccept={(ord) => act(ord, "accept")}
              onDismiss={(ord) => act(ord, "dismiss")}
            />
          ))}
          {sorted.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/2 px-4 py-10 text-center">
              <Bike className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-2 text-sm font-semibold text-zinc-400">Nenhuma corrida na praça agora</p>
              <p className="text-xs text-zinc-600">Novos pedidos aparecem aqui em tempo real</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/4 px-2.5 py-2.5">
      <p className="flex items-center gap-1 text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
        {icon} {label}
      </p>
      <p className={`mt-1 font-display font-extrabold text-white tabular-nums ${small ? "text-[13px]" : "text-base"}`}>{value}</p>
    </div>
  );
}

const CANCEL_REASONS = ["Problema no veículo", "Imprevisto pessoal", "Endereço muito longe", "Loja demorando demais", "Outro motivo"];

function CancelRideDialog({
  pickedUp, busy, onClose, onConfirm,
}: { pickedUp: boolean; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up w-full max-w-[420px] rounded-t-3xl border border-red-500/30 bg-[#0d1015] p-6 sm:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <p className="font-display text-xl font-black text-white">Desistir da corrida?</p>
        <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-[14px] font-bold text-red-200">⚠ Isso vai contar como cancelamento na sua nota.</p>
          <p className="mt-1 text-[12px] leading-snug text-red-200/80">
            Sua nota cai 0,2 ponto e a loja é avisada. Cada entrega concluída depois ajuda a recuperar.
          </p>
        </div>
        {pickedUp && (
          <p className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] leading-snug text-amber-100">
            Você já retirou o pedido: <b>devolva na loja</b> para outro entregador levar.
          </p>
        )}
        <p className="mt-4 text-[12px] font-bold text-zinc-400">O que aconteceu?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${
                reason === r ? "border-red-400 bg-red-500/20 text-red-200" : "border-white/10 bg-white/5 text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl bg-white/8 text-sm font-black text-white">
            CONTINUAR A CORRIDA
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={busy || !reason}
            className="h-12 flex-1 rounded-2xl bg-red-500 text-sm font-black text-white disabled:opacity-40"
          >
            SIM, CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
}
