"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, ChevronDown, Star, Check } from "lucide-react";
import { usePush } from "@/lib/usePush";
import type { Courier, CourierStatus } from "@/lib/types";
import { fmtBRL, STATUS_LABEL, initialsOf } from "@/lib/format";

interface Props {
  courier: Courier;
  todayNet: number;
  onStatusChange: (s: CourierStatus) => void;
  onOpenProfile: () => void;
  notify?: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

const SWITCHABLE: { value: CourierStatus; label: string; hint: string }[] = [
  { value: "online", label: "Online", hint: "Recebendo pedidos do feed" },
  { value: "pausa", label: "Em pausa", hint: "Pausado — sem novos pedidos" },
  { value: "offline", label: "Offline", hint: "Invisível para a rede" },
];

export default function Header({ courier, todayNet, onStatusChange, onOpenProfile, notify }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const push = usePush();
  const meta = STATUS_LABEL[courier.status] ?? STATUS_LABEL.online;

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#05070a]/92 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button onClick={onOpenProfile} className="relative shrink-0" aria-label="Abrir perfil">
          {courier.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={courier.photoUrl}
              alt={courier.name}
              className="h-12 w-12 rounded-2xl object-cover ring-2 ring-lime-400/70"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-500 text-sm font-black text-zinc-950 ring-2 ring-lime-400/70">
              {initialsOf(courier.name)}
            </span>
          )}
          <span className={`absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-[#05070a] ${meta.dot}`} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-bold text-white">
            {courier.name.split(" ")[0]}{" "}
            <span className="text-lime-300">“{courier.nickname}”</span>{" "}
            {courier.name.split(" ").slice(1).join(" ")}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" /> {courier.rating.toFixed(1)}
            </span>
            <span className="text-[11px] text-zinc-500">•</span>
            <span className="truncate text-[11px] text-zinc-400">
              {courier.vehicleModel} • {courier.vehiclePlate}
            </span>
          </div>
        </div>

        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className={`relative rounded-xl border p-2.5 ${
              push.state === "on" ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-white/10 bg-white/5 text-zinc-300"
            }`}
            aria-label="Avisos de corrida"
          >
            {push.state === "on" ? <BellRing className="h-5 w-5" /> : push.state === "denied" ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            {push.state === "off" && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-amber-400" />}
          </button>

          {bellOpen && (
            <div className="slide-up absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#0d1015] p-4 shadow-2xl">
              <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                <BellRing className="h-4 w-4 text-lime-400" /> Avisos de corrida
              </p>
              {push.state === "on" && (
                <>
                  <p className="mt-1.5 text-xs leading-snug text-zinc-400">
                    Ligado. Quando surgir corrida a até 5 km de você e você estiver <b className="text-zinc-200">Online</b>, o celular avisa, mesmo com o app fechado.
                  </p>
                  <button
                    onClick={async () => {
                      await push.sendTest();
                      notify?.("Teste enviado! Feche o app: o aviso chega em ~10 segundos.");
                      setBellOpen(false);
                    }}
                    className="mt-3 h-10 w-full rounded-xl bg-lime-400 text-xs font-black text-zinc-950 active:scale-95"
                  >
                    ENVIAR AVISO DE TESTE
                  </button>
                  <button
                    disabled={push.busy}
                    onClick={async () => {
                      await push.disable();
                      notify?.("Avisos de corrida desligados neste aparelho", "warn");
                    }}
                    className="mt-2 h-9 w-full rounded-xl bg-white/6 text-xs font-bold text-zinc-300 active:scale-95 disabled:opacity-50"
                  >
                    Desligar avisos
                  </button>
                </>
              )}
              {push.state === "off" && (
                <>
                  <p className="mt-1.5 text-xs leading-snug text-zinc-400">
                    Receba no celular cada corrida nova perto de você, mesmo com o app fechado.
                  </p>
                  <button
                    disabled={push.busy}
                    onClick={async () => {
                      const err = await push.enable();
                      notify?.(err ?? "Pronto! Você vai receber os avisos de corrida.", err ? "warn" : "ok");
                    }}
                    className="mt-3 h-10 w-full rounded-xl bg-lime-400 text-xs font-black text-zinc-950 active:scale-95 disabled:opacity-50"
                  >
                    {push.busy ? "LIGANDO…" : "LIGAR AVISOS DE CORRIDA"}
                  </button>
                </>
              )}
              {push.state === "denied" && (
                <p className="mt-1.5 text-xs leading-snug text-amber-200">
                  As notificações estão bloqueadas para o RotaLivre. Libere em Configurações do celular → Apps → (seu navegador ou RotaLivre) → Notificações, e volte aqui.
                </p>
              )}
              {push.state === "ios-install" && (
                <p className="mt-1.5 text-xs leading-snug text-amber-200">
                  No iPhone, instale primeiro o app na Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início) e abra por lá.
                </p>
              )}
              {(push.state === "unsupported" || push.state === "loading") && (
                <p className="mt-1.5 text-xs leading-snug text-zinc-400">
                  {push.state === "loading" ? "Verificando…" : "Este navegador não suporta notificações. Use o Chrome."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Saldo de hoje</p>
          <p className="font-display text-[26px] leading-none font-800 font-extrabold text-emerald-400 tabular-nums">
            {fmtBRL(todayNet)}
          </p>
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-bold ${meta.classes}`}
          >
            <span className={`h-2 w-2 rounded-full ${meta.dot} animate-pulse`} />
            {meta.label}
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
          {open && (
            <div className="slide-up absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#12151c] shadow-2xl shadow-black/60">
              <p className="border-b border-white/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Meu status
              </p>
              {courier.status === "em_entrega" && (
                <p className="border-b border-white/5 px-4 py-2.5 text-xs text-amber-300">
                  Você está em uma entrega. O status volta para Online ao concluir.
                </p>
              )}
              {SWITCHABLE.map((s) => (
                <button
                  key={s.value}
                  disabled={courier.status === "em_entrega"}
                  onClick={() => {
                    onStatusChange(s.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-40"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_LABEL[s.value].dot}`} />
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-white">{s.label}</span>
                    <span className="block text-[11px] text-zinc-500">{s.hint}</span>
                  </span>
                  {courier.status === s.value && <Check className="h-4 w-4 text-lime-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
