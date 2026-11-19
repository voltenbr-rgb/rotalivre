"use client";

import { useCallback, useEffect, useState } from "react";
import { Bike, ClipboardList, Copy, KeyRound, LifeBuoy, LogOut, MessageCircle, RefreshCw, Store as StoreIcon, X } from "lucide-react";
import { apiFetch } from "@/lib/session";
import { fmtBRL, fmtKm } from "@/lib/format";

type Overview = {
  stats: {
    stores: number; couriers: number; couriersOnline: number; ordersToday: number; deliveredToday: number;
    valueToday: number; supportOpen: number;
  };
  stores: { id: number; name: string; email: string; category: string; city: string; located: boolean; blocked: boolean; createdAt: string }[];
  couriers: {
    id: number; name: string; nickname: string; email: string; vehicleType: string; status: string;
    city: string; blocked: boolean; lastSeenAt: string | null; createdAt: string;
    rating: number; cancelCount: number; totalDeliveries: number;
  }[];
  support: {
    id: number; accountType: string; email: string; contact: string; message: string; kind: string; status: string; createdAt: string;
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
  const [tab, setTab] = useState<"suporte" | "lojas" | "entregadores" | "pedidos">("suporte");
  const [temp, setTemp] = useState<{ email: string; contact: string; password: string } | null>(null);
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

  const act = async (body: Record<string, unknown>) => {
    const res = await apiFetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      alertBox(out.error ?? "Não foi possível");
      return null;
    }
    load();
    return out;
  };

  const resetPassword = async (type: string, email: string, contact = "", requestId?: number) => {
    const out = await act({ action: "reset_password", type, email, requestId });
    if (out?.tempPassword) setTemp({ email, contact, password: out.tempPassword });
  };

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
          <Stat label="Suporte aberto" value={s?.supportOpen ?? "—"} />
        </section>

        <nav className="flex gap-1.5">
          {([
            { id: "suporte", label: `Suporte${s?.supportOpen ? ` (${s.supportOpen})` : ""}`, icon: LifeBuoy },
            { id: "lojas", label: "Lojas", icon: StoreIcon },
            { id: "entregadores", label: "Entregadores", icon: Bike },
            { id: "pedidos", label: "Pedidos", icon: ClipboardList },
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
          {tab === "suporte" &&
            (data?.support.length ? data.support.map((r) => (
              <Row
                key={r.id}
                title={`${r.kind === "senha" ? "🔑 Esqueceu a senha" : "💬 Suporte"} • ${r.accountType === "store" ? "Loja" : "Entregador"}`}
                sub={`${r.email} • WhatsApp ${r.contact}${r.message ? ` • “${r.message}”` : ""}`}
                right={r.status === "aberto" ? "aberto" : "resolvido"}
                foot={when(r.createdAt)}
              >
                {r.status === "aberto" && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <ActionBtn onClick={() => resetPassword(r.accountType, r.email, r.contact, r.id)} primary>
                      Gerar senha provisória
                    </ActionBtn>
                    <a href={waLink(r.contact)} target="_blank" rel="noreferrer" className={btnCls(false)}>
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                    <ActionBtn onClick={() => act({ action: "resolve", requestId: r.id })}>Marcar resolvido</ActionBtn>
                  </div>
                )}
              </Row>
            )) : <Empty text="Nenhum pedido de suporte" />)}
          {tab === "lojas" &&
            (data?.stores.length ? data.stores.map((x) => (
              <Row
                key={x.id}
                title={`${x.name}${x.blocked ? " 🚫" : ""}`}
                sub={`${x.email} • ${x.category}${x.city ? ` • ${x.city}` : ""}`}
                right={x.blocked ? "bloqueada" : x.located ? "📍 localizada" : "⚠ sem local"}
                foot={`Cadastro ${when(x.createdAt)}`}
              >
                <AccountActions
                  blocked={x.blocked}
                  onReset={() => resetPassword("store", x.email)}
                  onToggle={() => act({ action: x.blocked ? "unblock" : "block", type: "store", id: x.id })}
                />
              </Row>
            )) : <Empty text="Nenhuma loja cadastrada ainda" />)}
          {tab === "entregadores" &&
            (data?.couriers.length ? data.couriers.map((x) => (
              <Row
                key={x.id}
                title={`${x.name}${x.nickname ? ` “${x.nickname}”` : ""}${x.blocked ? " 🚫" : ""}`}
                sub={`${x.email} • ${VEHICLE[x.vehicleType] ?? x.vehicleType}${x.city ? ` • ${x.city}` : ""}`}
                right={x.blocked ? "bloqueado" : x.status}
                foot={`⭐ ${x.rating.toFixed(1)} • ${x.totalDeliveries} entregas • ${x.cancelCount} desistência${x.cancelCount === 1 ? "" : "s"} • visto ${when(x.lastSeenAt)}`}
              >
                <AccountActions
                  blocked={x.blocked}
                  onReset={() => resetPassword("courier", x.email)}
                  onToggle={() => act({ action: x.blocked ? "unblock" : "block", type: "courier", id: x.id })}
                />
              </Row>
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

      {/* Senha provisória gerada */}
      {temp && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-6" onClick={() => setTemp(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[360px] rounded-3xl border border-white/10 bg-[#0d1015] p-5">
            <div className="flex items-start justify-between">
              <p className="font-display text-lg font-black text-white">Senha provisória</p>
              <button onClick={() => setTemp(null)} className="text-zinc-500" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-zinc-400">{temp.email}</p>
            <p className="mt-3 rounded-2xl bg-white/6 py-3 text-center font-display text-3xl font-black tracking-[0.3em] text-lime-300">{temp.password}</p>
            <p className="mt-2 text-[12px] leading-snug text-zinc-500">
              Os aparelhos dessa conta foram desconectados. Mande a senha para a pessoa e peça para ela trocar no Perfil.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigator.clipboard?.writeText(temp.password)} className={btnCls(false)}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
              <a
                href={waLink(temp.contact, `Olá! Sua senha provisória do RotaLivre é ${temp.password}. Entre no app e troque em Perfil → Trocar minha senha.`)}
                target="_blank"
                rel="noreferrer"
                className={btnCls(true)}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Enviar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function waLink(contact: string, text?: string) {
  const digits = contact.replace(/\D/g, "");
  const phone = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function btnCls(primary: boolean) {
  return `flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold ${
    primary ? "bg-lime-400 text-zinc-950" : "bg-white/8 text-zinc-200"
  }`;
}

function ActionBtn({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={btnCls(primary)}>
      {children}
    </button>
  );
}

function AccountActions({ blocked, onReset, onToggle }: { blocked: boolean; onReset: () => void; onToggle: () => void }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <ActionBtn onClick={onReset}>Redefinir senha</ActionBtn>
      <button
        onClick={() => {
          if (confirmBox(blocked ? "Desbloquear esta conta?" : "Bloquear esta conta? Ela sai de todos os aparelhos.")) onToggle();
        }}
        className={`rounded-xl px-3 py-2 text-[12px] font-bold ${blocked ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
      >
        {blocked ? "Desbloquear" : "Bloquear"}
      </button>
    </div>
  );
}

/* O painel master roda no computador: confirm()/alert() nativos são suficientes aqui */
function confirmBox(msg: string) {
  return typeof window !== "undefined" ? window.confirm(msg) : false;
}
function alertBox(msg: string) {
  if (typeof window !== "undefined") window.alert(msg);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#101319] p-3">
      <p className="text-[11px] font-bold tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 font-display text-xl font-black text-white">{value}</p>
    </div>
  );
}

function Row({ title, sub, right, foot, children }: { title: string; sub: string; right: string; foot: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#101319] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[14px] font-bold text-white">{title}</p>
        <span className="shrink-0 rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-bold text-zinc-300">{right}</span>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-zinc-400">{sub}</p>
      <p className="mt-1 text-[11px] text-zinc-600">{foot}</p>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-white/8 bg-[#101319] p-6 text-center text-sm text-zinc-500">{text}</p>;
}
