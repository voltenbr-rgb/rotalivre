"use client";

import { useCallback, useEffect, useState } from "react";
import { Bike, ClipboardList, KeyRound, LogOut, RefreshCw, Store as StoreIcon } from "lucide-react";
import { apiFetch } from "@/lib/session";
import { fmtBRL, fmtKm } from "@/lib/format";

type Overview = {
  stats: { stores: number; couriers: number; couriersOnline: number; ordersToday: number; deliveredToday: number; valueToday: number };
  stores: { id: number; name: string; email: string; category: string; city: string; located: boolean; createdAt: string }[];
  couriers: {
    id: number; name: string; nickname: string; email: string; vehicleType: string; status: string;
    city: string; lastSeenAt: string | null; createdAt: string;
  }[];
  orders: { id: number; code: string; store: string; courier: string | null; status: string; valueNet: number; distanceKm: number; createdAt: string }[];
};

const VEHICLE: Record<string, string> = { moto: "🏍️ Moto", bicicleta: "🚲 Bicicleta", scooter: "🛴 Patinete", carro: "🚗 Carro" };
const STATUS: Record<string, string> = {
  available: "Aguardando", accepted: "Aceito", picked_up: "Em rota", delivered: "Entregue", cancelled: "Cancelado", expired: "Expirado",
};
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/** Painel master: visão geral de lojas, entregadores e pedidos reais */
export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"lojas" | "entregadores" | "pedidos">("lojas");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/overview");
      if (res.status === 401) return onLogout();
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const s = data?.stats;

  return (
    <div className="min-h-dvh bg-[#05070a]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05070a]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-zinc-200">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-white">Painel master</p>
            <p className="text-[12px] text-zinc-500">RotaLivre • visão geral</p>
          </div>
          <button onClick={load} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300" aria-label="Atualizar">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onLogout} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Lojas" value={s?.stores ?? "—"} />
          <Stat label="Entregadores" value={s?.couriers ?? "—"} />
          <Stat label="Online agora" value={s?.couriersOnline ?? "—"} />
          <Stat label="Pedidos 24 h" value={s?.ordersToday ?? "—"} />
          <Stat label="Entregues 24 h" value={s?.deliveredToday ?? "—"} />
          <Stat label="Pago a entregadores" value={s ? fmtBRL(s.valueToday) : "—"} />
        </section>

        <nav className="flex gap-1.5">
          {([
            { id: "lojas", label: "Lojas", icon: StoreIcon },
            { id: "entregadores", label: "Entregadores", icon: Bike },
            { id: "pedidos", label: "Pedidos de lojas", icon: ClipboardList },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold ${
                tab === t.id ? "bg-white text-zinc-950" : "bg-white/5 text-zinc-400"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        <section className="space-y-2">
          {tab === "lojas" &&
            (data?.stores.length ? data.stores.map((x) => (
              <Row key={x.id} title={x.name} sub={`${x.email} • ${x.category}${x.city ? ` • ${x.city}` : ""}`} right={x.located ? "📍 localizada" : "⚠ sem local"} foot={`Cadastro ${when(x.createdAt)}`} />
            )) : <Empty text="Nenhuma loja cadastrada ainda" />)}
          {tab === "entregadores" &&
            (data?.couriers.length ? data.couriers.map((x) => (
              <Row
                key={x.id}
                title={`${x.name}${x.nickname ? ` “${x.nickname}”` : ""}`}
                sub={`${x.email} • ${VEHICLE[x.vehicleType] ?? x.vehicleType}${x.city ? ` • ${x.city}` : ""}`}
                right={x.status}
                foot={`Visto ${when(x.lastSeenAt)} • cadastro ${when(x.createdAt)}`}
              />
            )) : <Empty text="Nenhum entregador ainda" />)}
          {tab === "pedidos" &&
            (data?.orders.length ? data.orders.map((x) => (
              <Row
                key={x.id}
                title={`${x.code} • ${x.store}`}
                sub={`${fmtBRL(x.valueNet)} • ${fmtKm(x.distanceKm)}${x.courier ? ` • ${x.courier}` : ""}`}
                right={STATUS[x.status] ?? x.status}
                foot={when(x.createdAt)}
              />
            )) : <Empty text="Nenhum pedido de loja ainda" />)}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#101319] p-3">
      <p className="text-[11px] font-bold tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 font-display text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Row({ title, sub, right, foot }: { title: string; sub: string; right: string; foot: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#101319] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[14px] font-bold text-white">{title}</p>
        <span className="shrink-0 rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-bold text-zinc-300">{right}</span>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-zinc-400">{sub}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{foot}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/8 bg-[#101319] p-6 text-center text-sm text-zinc-500">{text}</p>;
}
