"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bell, CircleCheck, ClipboardList, ClipboardPaste, Clock, Copy, Link2, LoaderCircle, Map as MapIcon, LocateFixed, LogOut, MapPin, MessageCircle,
  Package, Phone, Plus, Save, Store as StoreIcon, Trash2, User,
} from "lucide-react";
import PointPicker from "./PointPicker";
import { InstallBanner, InstallButton } from "./InstallApp";
import { ChangePassword } from "./ForgotPassword";
import { apiFetch } from "@/lib/session";
import { fmtBRL, fmtKm } from "@/lib/format";
import { haversineKm } from "@/lib/domain";
import type { Store, StoreOrder } from "@/lib/types";

const inputCls =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/4 px-4 text-[15px] text-white placeholder-zinc-600 outline-none transition focus:border-amber-400/60";

export const STORE_CATEGORIES = [
  { id: "Lanchonete", emoji: "🍔" }, { id: "Pizzaria", emoji: "🍕" }, { id: "Restaurante", emoji: "🍽️" },
  { id: "Marmitas", emoji: "🍱" }, { id: "Japonês", emoji: "🍣" }, { id: "Churrasco", emoji: "🥩" },
  { id: "Padaria", emoji: "🥖" }, { id: "Sobremesas", emoji: "🍨" }, { id: "Mercado", emoji: "🛒" },
  { id: "Farmácia", emoji: "💊" }, { id: "Saudável", emoji: "🥗" }, { id: "Outro", emoji: "🏪" },
];
const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false });

/** Avisos de cada etapa para a loja */
const STAGE_ALERT: Record<string, string> = {
  accepted: "🛵 {c} aceitou o pedido {code} e está indo à loja",
  picked_up: "📦 {c} retirou o pedido {code} — saiu para entrega",
  delivered: "✅ Pedido {code} entregue!",
  expired: "⚠ Ninguém aceitou o pedido {code}",
  available: "↩ O entregador desistiu do pedido {code}. Já avisamos outros entregadores.",
};

function beep(times = 2) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i % 2 ? 1320 : 880;
      const t0 = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.2);
    }
    setTimeout(() => ctx.close(), 1200);
  } catch { /* sem áudio */ }
  try { navigator.vibrate?.([120, 80, 120]); } catch { /* */ }
}

/** Tela de computador (≥ 1024 px): layout distribuído */
function useDesktop() {
  const [desk, setDesk] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

function trackUrl(token: string) {
  return `${window.location.origin}/acompanhar/${token}`;
}

const emojiOf = (c: string) => STORE_CATEGORIES.find((x) => x.id === c)?.emoji ?? "🏪";

const VEHICLES = [
  { id: "moto", label: "Moto", emoji: "🏍️" },
  { id: "bicicleta", label: "Bicicleta", emoji: "🚲" },
  { id: "scooter", label: "Patinete", emoji: "🛴" },
  { id: "carro", label: "Carro", emoji: "🚗" },
];
const vehicleLabel = (v: string | null) => VEHICLES.find((x) => x.id === v)?.label ?? "";

const STATUS: Record<string, { label: string; cls: string }> = {
  available: { label: "Procurando entregador", cls: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
  accepted: { label: "Entregador a caminho da loja", cls: "bg-sky-400/15 text-sky-300 border-sky-400/30" },
  picked_up: { label: "Saiu para entrega", cls: "bg-violet-400/15 text-violet-300 border-violet-400/30" },
  delivered: { label: "Entregue", cls: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30" },
  cancelled: { label: "Cancelado", cls: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20" },
  expired: { label: "Ninguém aceitou", cls: "bg-red-400/10 text-red-300 border-red-400/25" },
};

interface Props {
  store: Store;
  onStoreChange: (s: Store) => void;
  onLogout: () => void;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

type Tab = "novo" | "pedidos" | "loja";

export default function StoreApp({ store, onStoreChange, onLogout, notify }: Props) {
  const ready = !!store.name && store.lat != null && store.lng != null;
  const [tab, setTab] = useState<Tab>(ready ? "novo" : "loja");
  const [orders, setOrders] = useState<StoreOrder[]>([]);

  const prevStatus = useRef<Map<number, string> | null>(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiFetch("/api/store/orders");
      if (!res.ok) return;
      const list: StoreOrder[] = (await res.json()).orders ?? [];
      // Compara com a leitura anterior: avisa a loja em cada etapa
      const prev = prevStatus.current;
      if (prev) {
        for (const o of list) {
          const before = prev.get(o.id);
          if (before && before !== o.status && STAGE_ALERT[o.status]) {
            const msg = STAGE_ALERT[o.status]
              .replace("{c}", o.courierNickname || o.courierName || "O entregador")
              .replace("{code}", o.code);
            beep(o.status === "delivered" ? 3 : 2);
            notifyRef.current(msg, o.status === "expired" ? "warn" : "ok");
            try {
              if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
                const reg = await navigator.serviceWorker?.getRegistration();
                if (reg) reg.showNotification("RotaLivre • " + (STATUS[o.status]?.label ?? "Pedido"), { body: msg, tag: `loja-${o.id}`, icon: "/icons/icon-192.png" });
                else new Notification("RotaLivre", { body: msg });
              }
            } catch { /* sem notificação */ }
          }
        }
      }
      prevStatus.current = new Map(list.map((o) => [o.id, o.status]));
      setOrders(list);
    } catch { /* mantém */ }
  }, []);

  useEffect(() => {
    if (!ready) return;
    loadOrders();
    const t = setInterval(loadOrders, 8000);
    return () => clearInterval(t);
  }, [ready, loadOrders]);

  const [notifPerm, setNotifPerm] = useState<string>("default");
  useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);
  const askNotif = async () => {
    if (!("Notification" in window)) return notify("Este navegador não mostra avisos", "warn");
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === "granted") {
      beep(1);
      notify("Pronto! A loja vai ser avisada de cada etapa.");
    }
  };

  const active = orders.filter((o) => ["available", "accepted", "picked_up"].includes(o.status)).length;
  const todayStr = new Date().toDateString();
  const deliveredToday = orders.filter((o) => o.status === "delivered" && o.deliveredAt && new Date(o.deliveredAt).toDateString() === todayStr);
  const waiting = orders.filter((o) => o.status === "available").length;
  const spentToday = deliveredToday.reduce((sum, o) => sum + o.valueNet, 0);

  const TABS = [
    { id: "novo", label: "Novo pedido", icon: Plus },
    { id: "pedidos", label: `Pedidos${active ? ` (${active})` : ""}`, icon: ClipboardList },
    { id: "loja", label: "Minha loja", icon: StoreIcon },
  ] as const;
  const TITLES: Record<Tab, { title: string; sub: string }> = {
    novo: { title: "Novo pedido", sub: "Cole a localização do cliente, confira o valor e chame um entregador." },
    pedidos: { title: "Pedidos", sub: "Acompanhe cada entrega ao vivo — atualiza sozinho." },
    loja: { title: "Minha loja", sub: "Dados e localização de onde os entregadores retiram os pedidos." },
  };

  return (
    <div className="min-h-dvh bg-[#05070a]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/6 bg-[#080a0e] p-5 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-2xl">{emojiOf(store.category)}</span>
          <div className="min-w-0">
            <p className="truncate text-[17px] leading-tight font-bold text-white">{store.name || "Minha loja"}</p>
            <p className="truncate text-[12px] text-amber-300">Painel do lojista</p>
          </div>
        </div>

        {ready && (
          <nav className="mt-8 space-y-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-bold transition ${
                  tab === t.id ? "bg-amber-400 text-zinc-950 shadow-[0_8px_24px_rgba(251,191,36,0.25)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <t.icon className="h-5 w-5" /> {t.label}
              </button>
            ))}
          </nav>
        )}

        {ready && (
          <div className="mt-8 space-y-2.5">
            <p className="px-1 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">Hoje</p>
            <SideStat label="Em andamento" value={String(active)} tone="text-sky-300" />
            <SideStat label="Esperando entregador" value={String(waiting)} tone={waiting ? "text-amber-300" : "text-white"} />
            <SideStat label="Entregues" value={String(deliveredToday.length)} tone="text-emerald-300" />
            <SideStat label="Pago a entregadores" value={fmtBRL(spentToday)} tone="text-lime-300" />
          </div>
        )}

        <div className="mt-auto space-y-2.5">
          <InstallButton className="h-11 w-full text-xs" label="Instalar app" />
          <button
            onClick={onLogout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/4 text-[13px] font-bold text-zinc-300 hover:bg-white/8"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
          <p className="truncate text-center text-[11px] text-zinc-600">{store.email}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05070a]/92 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl">{emojiOf(store.category)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] leading-tight font-bold text-white">{store.name || "Minha loja"}</p>
            <p className="truncate text-[12px] text-amber-300">Painel do lojista</p>
          </div>
          <div className="hidden sm:block">
            <InstallButton className="h-11 px-4 text-xs" label="Instalar app" />
          </div>
          <button onClick={onLogout} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        {ready && (
          <nav className="mx-auto flex max-w-3xl gap-1.5 px-4 pb-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition ${
                  tab === t.id ? "bg-amber-400 text-zinc-950" : "bg-white/5 text-zinc-400"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 lg:ml-72 lg:max-w-none lg:px-10 lg:py-8">
        <div className="space-y-4 lg:mx-auto lg:max-w-[1240px]">
        <div className="hidden lg:block">
          <h1 className="font-display text-3xl font-black text-white">{TITLES[tab as Tab].title}</h1>
          <p className="mt-1 text-[14px] text-zinc-400">{TITLES[tab as Tab].sub}</p>
        </div>
        {/* Convite para instalar o app (celular ou computador da loja) */}
        <InstallBanner />
        {tab === "loja" && (
          <StoreProfile
            store={store}
            firstTime={!ready}
            onSaved={(s) => {
              onStoreChange(s);
              if (!ready && s.name && s.lat != null) {
                notify("Loja pronta! Agora é só lançar os pedidos.");
                setTab("novo");
              } else notify("Dados da loja salvos");
            }}
            notify={notify}
          />
        )}
        {tab === "novo" && ready && (
          <NewOrder
            store={store}
            notify={notify}
            onCreated={() => {
              loadOrders();
              setTab("pedidos");
            }}
          />
        )}
        {tab === "pedidos" && ready && (
          <>
            {notifPerm !== "granted" && (
              <button
                onClick={askNotif}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left"
              >
                <Bell className="h-5 w-5 shrink-0 text-amber-300" />
                <span className="text-[13px] leading-snug text-amber-100">
                  <b>Ativar avisos da loja</b> — toque para ser avisado (som + notificação) quando o entregador aceitar, retirar e entregar.
                </span>
              </button>
            )}
            <OrdersList orders={orders} reload={loadOrders} notify={notify} />
          </>
        )}

        {tab === "loja" && ready && (
          <div className="mt-6 space-y-3 lg:max-w-md">
            <InstallButton className="h-12 w-full text-sm lg:hidden" />
            <ChangePassword endpoint="/api/store/auth" notify={notify} />
            <p className="text-center text-[11px] text-zinc-600 lg:hidden">Logado como {store.email}</p>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadastro / edição da loja                                           */
/* ------------------------------------------------------------------ */
function StoreProfile({
  store, firstTime, onSaved, notify,
}: { store: Store; firstTime: boolean; onSaved: (s: Store) => void; notify: Props["notify"] }) {
  const [f, setF] = useState({
    name: store.name, category: store.category || "Restaurante", phone: store.phone,
    address: store.address, neighborhood: store.neighborhood, city: store.city || "Corumbá",
  });
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    store.lat != null && store.lng != null ? { lat: store.lat, lng: store.lng } : null,
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      notify("Este aparelho não tem GPS. Marque no mapa.", "warn");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
        notify("Localização da loja marcada. Confira o pino no mapa.");
      },
      () => {
        setLocating(false);
        notify("Não consegui pegar a localização. Marque tocando no mapa.", "warn");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const save = async () => {
    if (f.name.trim().length < 2) return notify("Informe o nome da loja", "warn");
    if (!pos) return notify("Marque no mapa onde fica a loja", "warn");
    setSaving(true);
    try {
      const res = await apiFetch("/api/store/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, lat: pos.lat, lng: pos.lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.store);
    } catch {
      notify("Não foi possível salvar. Tente de novo.", "warn");
    } finally {
      setSaving(false);
    }
  };

  const desk = useDesktop();
  const mapBlock = (
      <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold tracking-wide text-zinc-400 uppercase">Onde fica a loja</p>
        <button onClick={useMyLocation} disabled={locating} className="flex items-center gap-1 text-xs font-bold text-amber-300 disabled:opacity-50">
          {locating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          Estou na loja agora
        </button>
      </div>
      <PointPicker value={pos} onChange={setPos} pinEmoji={emojiOf(f.category)} height={desk ? 540 : 300} />
      <p className="mt-1.5 text-[11px] text-zinc-500">
        Dica: toque em “Estou na loja agora” estando na porta da loja, ou aproxime o mapa e toque no lugar exato.
      </p>
    </div>
  );
  return (
    <section className={TWO_COL}>
      <div className="space-y-4 lg:space-y-5">
      {firstTime && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="font-display text-lg font-extrabold text-white">Vamos deixar sua loja pronta 🏪</p>
          <p className="mt-1 text-[13px] leading-snug text-amber-100/80">
            Nome, tipo e onde ela fica. É daqui que os entregadores vão buscar os pedidos, então capriche no pino do mapa.
          </p>
        </div>
      )}

      <Field label="Nome da loja">
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Lanchonete do Zé" />
      </Field>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-zinc-400 uppercase">Tipo de comércio</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {STORE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setF({ ...f, category: c.id })}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[11px] font-bold ${
                f.category === c.id ? "border-amber-400 bg-amber-400/12 text-amber-200" : "border-white/10 bg-white/4 text-zinc-400"
              }`}
            >
              <span className="text-xl leading-none">{c.emoji}</span>
              {c.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="WhatsApp da loja (opcional)">
          <input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(67) 90000-0000" inputMode="tel" />
        </Field>
        <Field label="Endereço">
          <input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Rua, número" />
        </Field>
        <Field label="Bairro">
          <input className={inputCls} value={f.neighborhood} onChange={(e) => setF({ ...f, neighborhood: e.target.value })} placeholder="Ex.: Centro" />
        </Field>
        <Field label="Cidade">
          <input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Corumbá" />
        </Field>
      </div>

      {!desk && mapBlock}

      <button
        onClick={save}
        disabled={saving}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-base font-black text-zinc-950 active:scale-[0.98] disabled:opacity-60"
      >
        {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        {firstTime ? "SALVAR E COMEÇAR" : "SALVAR DADOS DA LOJA"}
      </button>
      </div>
      {desk && <div className="sticky top-8 self-start">{mapBlock}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Lançar pedido                                                       */
/* ------------------------------------------------------------------ */
function NewOrder({ store, notify, onCreated }: { store: Store; notify: Props["notify"]; onCreated: () => void }) {
  const anchor = { lat: store.lat!, lng: store.lng! };
  const [f, setF] = useState({ clientName: "", clientPhone: "", deliveryAddress: "", deliveryNeighborhood: "", notes: "", itemsCount: 1 });
  const [dest, setDest] = useState<{ lat: number; lng: number } | null>(null);
  const [payment, setPayment] = useState("Pix");
  // Padrão: qualquer veículo. Desligando, a loja marca quais aceita.
  const [anyVehicle, setAnyVehicle] = useState(true);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [valueTouched, setValueTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [locating, setLocating] = useState(false);
  const [pastedFrom, setPastedFrom] = useState("");

  // Cliente mandou a localização no WhatsApp: cola aqui e o ponto já aparece no mapa
  const applyPasted = async (raw?: string) => {
    let text = raw ?? pasteText;
    if (!text.trim()) {
      try {
        text = await navigator.clipboard.readText();
        setPasteText(text);
      } catch {
        return notify("Cole o link ou as coordenadas no campo", "warn");
      }
    }
    if (!text.trim()) return notify("A área de transferência está vazia", "warn");
    setLocating(true);
    try {
      const res = await apiFetch("/api/geo/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return notify(data.error ?? "Não achei a localização", "warn");
      const far = haversineKm(anchor.lat, anchor.lng, data.lat, data.lng);
      if (far > 60) return notify(`Esse ponto fica a ${Math.round(far)} km da loja. Confira o link.`, "warn");
      setDest({ lat: data.lat, lng: data.lng });
      setF((cur) => ({
        ...cur,
        deliveryAddress: cur.deliveryAddress.trim() ? cur.deliveryAddress : data.address ?? "",
        deliveryNeighborhood: cur.deliveryNeighborhood.trim() ? cur.deliveryNeighborhood : data.neighborhood ?? "",
      }));
      setPastedFrom(data.address ? `${data.address}${data.neighborhood ? ` • ${data.neighborhood}` : ""}` : `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`);
      notify("Localização marcada no mapa! Confira o número da casa.");
    } catch {
      notify("Falha de conexão. Tente de novo.", "warn");
    } finally {
      setLocating(false);
    }
  };

  const km = useMemo(
    () => (dest ? Math.max(0.5, Math.round(haversineKm(anchor.lat, anchor.lng, dest.lat, dest.lng) * 1.3 * 10) / 10) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dest?.lat, dest?.lng],
  );
  // Sugestão de valor pela distância (a loja pode mudar)
  const suggested = km != null ? Math.round((5 + km * 2.3) * 2) / 2 : null;
  useEffect(() => {
    if (!valueTouched && suggested != null) setValue(suggested.toFixed(2).replace(".", ","));
  }, [suggested, valueTouched]);

  const toggleVehicle = (id: string) =>
    setVehicles((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const submit = async () => {
    const valueNet = parseFloat(value.replace(",", "."));
    if (!f.clientName.trim()) return notify("Informe o nome do cliente", "warn");
    if (!f.deliveryAddress.trim()) return notify("Informe o endereço de entrega", "warn");
    if (!dest) return notify("Toque no mapa para marcar o ponto de entrega", "warn");
    if (!Number.isFinite(valueNet)) return notify("Informe o valor da entrega", "warn");
    if (!anyVehicle && vehicles.length === 0) return notify("Marque pelo menos um veículo, ou ligue “Qualquer veículo”", "warn");
    setSending(true);
    try {
      const res = await apiFetch("/api/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          deliveryLat: dest.lat,
          deliveryLng: dest.lng,
          valueNet,
          paymentMethod: payment,
          acceptedVehicles: anyVehicle ? [] : vehicles, // [] = todos
        }),
      });
      const data = await res.json();
      if (!res.ok) return notify(data.error ?? "Não foi possível lançar", "warn");
      notify(`Pedido ${data.order.code} lançado! Código de entrega: ${data.order.deliveryCode}. Envie ao cliente.`);
      if (navigator.vibrate) navigator.vibrate(60);
      onCreated();
    } catch {
      notify("Falha de conexão. Tente de novo.", "warn");
    } finally {
      setSending(false);
    }
  };

  const desk = useDesktop();
  const mapBlock = (
      <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-zinc-400 uppercase">Ponto de entrega no mapa</p>
      <PointPicker value={dest} onChange={setDest} anchor={anchor} anchorEmoji={emojiOf(store.category)} pinEmoji="🏠" height={desk ? 560 : 280} />
      {km != null && <p className="mt-1.5 text-[12px] text-zinc-400">Distância aproximada pelas ruas: <b className="text-white">{fmtKm(km)}</b></p>}
    </div>
  );
  return (
    <section className={TWO_COL}>
      <div className="space-y-4 lg:space-y-5">
      <div className="rounded-2xl border border-lime-400/25 bg-lime-400/6 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-lime-300 uppercase">
          <ClipboardPaste className="h-3.5 w-3.5" /> Cliente mandou a localização?
        </p>
        <p className="mt-0.5 text-[12px] text-zinc-400">Cole o link do Google Maps, a localização do WhatsApp ou as coordenadas.</p>
        <div className="mt-2 flex gap-2">
          <input
            className={inputCls + " min-w-0 flex-1"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (t) {
                e.preventDefault();
                setPasteText(t);
                applyPasted(t);
              }
            }}
            placeholder="maps.app.goo.gl/…  ou  -19.0089, -57.6527"
          />
          <button
            onClick={() => applyPasted()}
            disabled={locating}
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-lime-400 px-4 text-sm font-black text-zinc-950 active:scale-95 disabled:opacity-60"
          >
            {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
            {pasteText.trim() ? "Usar" : "Colar"}
          </button>
        </div>
        {pastedFrom && <p className="mt-1.5 text-[12px] text-lime-200">📍 {pastedFrom}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do cliente" icon={<User className="h-3.5 w-3.5" />}>
          <input className={inputCls} value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Ex.: Maria" />
        </Field>
        <Field label="Telefone do cliente (opcional)" icon={<Phone className="h-3.5 w-3.5" />}>
          <input className={inputCls} value={f.clientPhone} onChange={(e) => setF({ ...f, clientPhone: e.target.value })} placeholder="(67) 9…" inputMode="tel" />
        </Field>
        <Field label="Endereço de entrega" icon={<MapPin className="h-3.5 w-3.5" />}>
          <input className={inputCls} value={f.deliveryAddress} onChange={(e) => setF({ ...f, deliveryAddress: e.target.value })} placeholder="Rua, número, complemento" />
        </Field>
        <Field label="Bairro">
          <input className={inputCls} value={f.deliveryNeighborhood} onChange={(e) => setF({ ...f, deliveryNeighborhood: e.target.value })} placeholder="Ex.: Popular Velha" />
        </Field>
      </div>

      {!desk && mapBlock}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor para o entregador (R$)">
          <input
            className={inputCls}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setValueTouched(true);
            }}
            placeholder={suggested != null ? suggested.toFixed(2) : "0,00"}
            inputMode="decimal"
          />
          {suggested != null && <span className="mt-1 block text-[11px] text-zinc-500">Sugerido pela distância: {fmtBRL(suggested)}</span>}
        </Field>
        <Field label="Itens">
          <input
            className={inputCls}
            type="number"
            min={1}
            value={f.itemsCount}
            onChange={(e) => setF({ ...f, itemsCount: Math.max(1, parseInt(e.target.value) || 1) })}
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-zinc-400 uppercase">Pagamento do cliente</p>
        <div className="flex flex-wrap gap-2">
          {["Pix", "Cartão", "Dinheiro", "Já pago"].map((p) => (
            <button
              key={p}
              onClick={() => setPayment(p)}
              className={`rounded-full border px-4 py-2 text-[13px] font-bold ${
                payment === p ? "border-amber-400 bg-amber-400/12 text-amber-200" : "border-white/10 bg-white/4 text-zinc-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-zinc-400 uppercase">Quem pode pegar este pedido?</p>
        <button
          onClick={() => setAnyVehicle((v) => !v)}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
            anyVehicle ? "border-lime-400 bg-lime-400/12" : "border-white/10 bg-white/4"
          }`}
        >
          <span>
            <span className={`block text-[14px] font-extrabold ${anyVehicle ? "text-lime-300" : "text-zinc-300"}`}>Qualquer veículo</span>
            <span className="block text-[11px] text-zinc-500">Moto, bicicleta, patinete ou carro</span>
          </span>
          <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${anyVehicle ? "bg-lime-400" : "bg-white/15"}`}>
            <span className={`h-5 w-5 rounded-full bg-white shadow transition ${anyVehicle ? "translate-x-5" : ""}`} />
          </span>
        </button>

        {!anyVehicle && (
          <div className="slide-up mt-2">
            <p className="mb-2 text-[12px] text-zinc-400">Toque para <b className="text-white">marcar</b> os veículos aceitos:</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLES.map((v) => {
                const on = vehicles.includes(v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVehicle(v.id)}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[11px] font-bold ${
                      on ? "border-lime-400 bg-lime-400/12 text-lime-300" : "border-white/10 bg-white/4 text-zinc-500"
                    }`}
                  >
                    {on && <CircleCheck className="absolute top-1 right-1 h-3.5 w-3.5 text-lime-400" />}
                    <span className="text-xl leading-none">{v.emoji}</span>
                    {v.label}
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 text-[12px] ${vehicles.length ? "text-zinc-400" : "text-amber-300"}`}>
              {vehicles.length
                ? `Só entregadores de ${vehicles.map((id) => vehicleLabel(id).toLowerCase()).join(", ")} vão ver este pedido.`
                : "Nenhum veículo marcado ainda."}
            </p>
          </div>
        )}
      </div>

      <Field label="Observação para o entregador (opcional)">
        <input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex.: pedido frágil, troco para R$ 50" />
      </Field>

      <button
        onClick={submit}
        disabled={sending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black text-zinc-950 shadow-[0_12px_28px_rgba(163,230,53,0.3)] active:scale-[0.98] disabled:opacity-60"
      >
        {sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />} CHAMAR ENTREGADOR
      </button>
      </div>
      {desk && <div className="sticky top-8 self-start">{mapBlock}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Acompanhar pedidos                                                  */
/* ------------------------------------------------------------------ */
function OrdersList({ orders, reload, notify }: { orders: StoreOrder[]; reload: () => void; notify: Props["notify"] }) {
  const confirmDelivered = async (id: number) => {
    const res = await apiFetch(`/api/store/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_delivered" }),
    });
    const data = await res.json().catch(() => ({}));
    notify(res.ok ? "Entrega confirmada pela loja" : data.error ?? "Não foi possível confirmar", res.ok ? "ok" : "warn");
    reload();
  };

  const [mapOpen, setMapOpen] = useState<number | null>(null);

  const raise = async (id: number, amount: number, relaunch = false) => {
    const res = await apiFetch(`/api/store/orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: relaunch ? "relaunch" : "raise", amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) notify(data.error ?? "Não foi possível", "warn");
    else if (relaunch) notify(`Pedido relançado por ${fmtBRL(data.valueNet)} — entregadores avisados`);
    else notify(`Valor aumentado para ${fmtBRL(data.valueNet)} — entregadores avisados de novo`);
    reload();
  };

  const shareTrack = async (o: StoreOrder) => {
    if (!o.publicToken) return notify("Link ainda sendo gerado, tente em instantes", "warn");
    const url = trackUrl(o.publicToken);
    const text = `Acompanhe seu pedido ${o.code} da ${o.establishment} ao vivo: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Acompanhe seu pedido", text, url });
        return;
      }
    } catch { /* cancelou */ return; }
    copyText(url, notify);
  };

  const cancel = async (id: number) => {
    const res = await apiFetch(`/api/store/orders/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    notify(res.ok ? "Pedido cancelado" : data.error ?? "Não foi possível cancelar", res.ok ? "ok" : "warn");
    reload();
  };

  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-white/8 bg-[#101319] p-8 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-2 text-sm text-zinc-400">Nenhum pedido nos últimos 7 dias.</p>
      </div>
    );
  }

  return (
    <section className="grid gap-3 lg:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
      {orders.map((o) => {
        const st = STATUS[o.status] ?? STATUS.available;
        const time = new Date(o.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        const wa = o.courierPhone ? `https://wa.me/55${o.courierPhone.replace(/\D/g, "")}` : null;
        const open = ["available", "accepted", "picked_up"].includes(o.status);
        // Mensagem pronta para o cliente com o código de entrega
        const link = o.publicToken && typeof window !== "undefined" ? trackUrl(o.publicToken) : "";
        const clientMsg = encodeURIComponent(
          `Olá, ${o.clientName}! Seu pedido ${o.code} já está com a gente. ` +
            `Quando o entregador chegar, informe o código de entrega: ${o.deliveryCode}` +
            (link ? `\n\nAcompanhe ao vivo: ${link}` : ""),
        );
        const stale = o.status === "available" && o.waitingMinutes >= 5;
        const dropped = o.status === "available" && o.desistCount > 0;
        const canRelaunch = o.status === "cancelled" || o.status === "expired";
        const clientWa = o.clientPhone ? `https://wa.me/55${o.clientPhone.replace(/\D/g, "")}?text=${clientMsg}` : `https://wa.me/?text=${clientMsg}`;
        return (
          <article key={o.id} className="flex flex-col rounded-3xl border border-white/8 bg-[#101319] p-4 lg:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-white">
                  {o.code} • {o.clientName}
                </p>
                <p className="truncate text-[13px] text-zinc-400">
                  {o.deliveryAddress}
                  {o.deliveryNeighborhood && ` • ${o.deliveryNeighborhood}`}
                </p>
              </div>
              <p className="shrink-0 text-[15px] font-black text-lime-300">{fmtBRL(o.valueNet)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full border px-2.5 py-1 font-bold ${st.cls}`}>{st.label}</span>
              <span className="flex items-center gap-1 text-zinc-500">
                <Clock className="h-3 w-3" /> {time} • {fmtKm(o.distanceKm)}
              </span>
              <span className="text-zinc-500">
                •{" "}
                {!o.acceptedVehicles || o.acceptedVehicles === "todos"
                  ? "qualquer veículo"
                  : o.acceptedVehicles.split(",").map((v) => vehicleLabel(v).toLowerCase()).join(", ")}
              </span>
            </div>

            {o.notes && (
              <p className="mt-2 line-clamp-2 rounded-xl bg-white/4 px-3 py-2 text-[12px] leading-snug text-zinc-300" title={o.notes}>
                📝 {o.notes}
              </p>
            )}

            {o.status === "available" && (
              <div className={`mt-3 rounded-2xl border p-3 ${dropped || stale ? "border-amber-400/30 bg-amber-400/10" : "border-white/8 bg-white/3"}`}>
                {dropped ? (
                  <p className="text-[13px] leading-snug text-amber-100">
                    ↩ <b>O entregador desistiu</b> e o pedido voltou para a praça. Aumentar o valor ajuda a sair mais rápido.
                  </p>
                ) : stale ? (
                  <p className="text-[13px] leading-snug text-amber-100">
                    ⏳ <b>{o.waitingMinutes} min sem entregador.</b> Já avisamos de novo num raio maior. Aumentar o valor ajuda.
                  </p>
                ) : (
                  <p className="text-[12px] text-zinc-400">Quer que saia mais rápido? Aumente o valor da entrega:</p>
                )}
                <div className="mt-2 flex gap-2">
                  {[2, 5].map((v) => (
                    <button key={v} onClick={() => raise(o.id, v)} className="rounded-xl bg-amber-400 px-3.5 py-2 text-[13px] font-black text-zinc-950 active:scale-95">
                      + R$ {v},00 ({fmtBRL(o.valueNet + v)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {canRelaunch && (
              <div className="mt-3 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-3">
                <p className="text-[13px] leading-snug text-lime-100">
                  {o.status === "expired" ? "Ninguém pegou esse pedido." : "Pedido cancelado."} Quer lançar de novo?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => raise(o.id, 0, true)} className="rounded-xl bg-white/10 px-3.5 py-2 text-[13px] font-bold text-white active:scale-95">
                    Relançar ({fmtBRL(o.valueNet)})
                  </button>
                  {[2, 5].map((v) => (
                    <button key={v} onClick={() => raise(o.id, v, true)} className="rounded-xl bg-lime-400 px-3.5 py-2 text-[13px] font-black text-zinc-950 active:scale-95">
                      Relançar + R$ {v} ({fmtBRL(o.valueNet + v)})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {o.deliveryCode && open && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold tracking-widest text-lime-300/80 uppercase">Código de entrega (só para o cliente)</p>
                  <p className="font-display text-2xl font-black tracking-[0.3em] text-white">{o.deliveryCode}</p>
                  {o.deliveryCodeAttempts > 0 && (
                    <p className="text-[11px] text-amber-300">O entregador errou o código {o.deliveryCodeAttempts}x</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => copyText(o.deliveryCode!, notify)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-bold text-white active:scale-95"
                  >
                    <Copy className="h-4 w-4" /> Copiar código
                  </button>
                  <a href={clientWa} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-[12px] font-bold text-white">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </div>
              </div>
            )}

            {o.courierName && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/4 p-3">
                <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                <p className="min-w-0 flex-1 text-[13px] text-zinc-300">
                  <b className="text-white">{o.courierNickname || o.courierName}</b>
                  {o.courierVehicle && ` • ${vehicleLabel(o.courierVehicle)}`}
                </p>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-[12px] font-bold text-white">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </div>
            )}

            {(o.status === "accepted" || o.status === "picked_up") && (
              <div className="mt-2">
                <button
                  onClick={() => setMapOpen(mapOpen === o.id ? null : o.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-2 text-[12px] font-bold text-sky-300"
                >
                  <MapIcon className="h-4 w-4" /> {mapOpen === o.id ? "Fechar mapa" : "Ver entregador no mapa ao vivo"}
                </button>
                {mapOpen === o.id && (
                  <div className="mt-2">
                    {o.courierPos ? (
                      <>
                        <LiveMap
                          pickup={{ lat: o.pickupLat, lng: o.pickupLng }}
                          delivery={{ lat: o.deliveryLat, lng: o.deliveryLng }}
                          courier={o.courierPos}
                          courierEmoji={VEHICLES.find((v) => v.id === o.courierVehicle)?.emoji ?? "🛵"}
                        />
                        {o.courierPos.seenAt && (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Posição de {new Date(o.courierPos.seenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} • atualiza sozinho
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="rounded-xl bg-white/4 p-3 text-[12px] text-zinc-400">O entregador ainda não enviou a localização (GPS desligado ou app fechado).</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {open && o.publicToken && (
              <button onClick={() => shareTrack(o)} className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-lime-300">
                <Link2 className="h-3.5 w-3.5" /> Enviar link de acompanhamento ao cliente
              </button>
            )}

            {(o.status === "available" || o.status === "accepted" || o.status === "picked_up") && (
              <div className="mt-auto pt-3">
                <div className="border-t border-white/6 pt-3">
                  {o.status === "available" ? (
                    <button onClick={() => cancel(o.id)} className="flex items-center gap-1.5 text-[12px] font-bold text-red-300">
                      <Trash2 className="h-3.5 w-3.5" /> Cancelar pedido
                    </button>
                  ) : (
                    <button onClick={() => confirmDelivered(o.id)} className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-400">
                      <CircleCheck className="h-3.5 w-3.5" /> Confirmar entrega pela loja (cliente sem o código)
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function Field({ label, icon, children, className = "" }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-400 uppercase">
        {icon} {label}
      </span>
      {children}
    </label>
  );
}

/** Copia para a área de transferência (com plano B para navegadores antigos) */
async function copyText(text: string, notify: Props["notify"]) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
    } finally {
      t.remove();
    }
  }
  notify(text.startsWith("http") ? "Link copiado — cole no WhatsApp do cliente" : `Código ${text} copiado`);
}

/* Duas colunas no computador: dados à esquerda, mapa fixo à direita */
const TWO_COL = "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-8";

function SideStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3">
      <span className="text-[12px] text-zinc-400">{label}</span>
      <span className={`font-display text-lg font-black ${tone}`}>{value}</span>
    </div>
  );
}
