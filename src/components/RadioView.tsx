"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudRainWind, Play, Pause, Radio, Send, ShieldExclamationPoint, Siren,
  Store, TriangleExclamationPoint, Users,
} from "lucide-react";
import type { ChatMessage, Courier } from "@/lib/types";
import { ALERT_META, clockTime, colorForId, initialsOf } from "@/lib/format";
import { CHANNELS } from "@/lib/domain";
import PttButton from "./PttButton";
import { apiFetch } from "@/lib/session";

interface Props {
  courier: Courier;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

const ALERT_BUTTONS = [
  { type: "blitz", label: "Blitz", icon: ShieldExclamationPoint, classes: "border-sky-400/40 bg-sky-400/12 text-sky-200" },
  { type: "alagamento", label: "Alagamento", icon: CloudRainWind, classes: "border-cyan-400/40 bg-cyan-400/12 text-cyan-200" },
  { type: "risco", label: "Área de risco", icon: TriangleExclamationPoint, classes: "border-amber-400/40 bg-amber-400/12 text-amber-200" },
  { type: "restaurante", label: "Restaurante lento", icon: Store, classes: "border-orange-400/40 bg-orange-400/12 text-orange-200" },
  { type: "sos", label: "SOS", icon: Siren, classes: "border-red-500/60 bg-red-500/20 text-red-200" },
] as const;

const ALERT_ICONS: Record<string, typeof ShieldExclamationPoint> = {
  blitz: ShieldExclamationPoint, alagamento: CloudRainWind, risco: TriangleExclamationPoint, restaurante: Store, sos: Siren,
};

export default function RadioView({ courier, notify }: Props) {
  const [channel, setChannel] = useState("Zona Sul");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/messages?channel=${encodeURIComponent(channel)}`);
      const data = await res.json();
      const list: ChatMessage[] = data.messages ?? [];
      const newOnes = list.filter((m) => m.id > lastIdRef.current && !m.isMe);
      if (lastIdRef.current > 0 && newOnes.length > 0) {
        const last = newOnes[newOnes.length - 1];
        if (last.kind === "alerta") notify(`Alerta de ${last.senderNickname}: ${ALERT_META[last.alertType ?? "risco"]?.label}`, last.alertType === "sos" ? "sos" : "warn");
      }
      if (list.length) lastIdRef.current = Math.max(lastIdRef.current, list[list.length - 1].id);
      setMessages(list);
    } catch { /* mantém */ }
  }, [channel, notify]);

  useEffect(() => {
    lastIdRef.current = 0;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, channel]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await apiFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, neighborhood: courier.neighborhood, ...payload }),
    });
    const data = await res.json();
    if (data.message) {
      lastIdRef.current = Math.max(lastIdRef.current, data.message.id);
      setMessages((prev) => [...prev, data.message]);
    }
    return data.message as ChatMessage | undefined;
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    await post({ kind: "texto", content });
  };

  const sendAlert = async (type: (typeof ALERT_BUTTONS)[number]["type"]) => {
    const meta = ALERT_META[type];
    const content =
      type === "sos"
        ? "Preciso de ajuda agora! Pane/acidente — quem estiver perto, por favor venha."
        : `${meta.label} em ${courier.neighborhood} — fiquem atentos, rapaziada`;
    await post({ kind: "alerta", alertType: type, content });
    notify(type === "sos" ? "SOS transmitido para toda a rede próxima" : `Alerta enviado ao canal ${channel}`, type === "sos" ? "sos" : "ok");
    if (navigator.vibrate) navigator.vibrate(type === "sos" ? [120, 60, 120] : 50);
  };

  const sendAudio = async (durationSec: number, audioUrl: string | null) => {
    const msg = await post({ kind: "audio", audioDurationSec: durationSec, content: "" });
    if (msg && audioUrl) setAudioUrls((prev) => ({ ...prev, [msg.id]: audioUrl }));
    notify(`Áudio de ${durationSec}s transmitido no canal ${channel}`);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col lg:max-w-3xl">
      {/* Seletor de canal */}
      <div className="border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-white">
            <Radio className="h-5 w-5 text-lime-400" /> Rádio da rede
          </h2>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
            <Users className="h-3.5 w-3.5 text-emerald-400" /> 6 parceiros ouvindo
          </span>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {CHANNELS.map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                channel === c ? "bg-lime-400 text-zinc-950" : "border border-white/10 bg-white/4 text-zinc-400"
              }`}
            >
              {c} • 5 km
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Canal <span className="font-bold text-zinc-300">{channel}</span> — voz e texto com entregadores num raio de 5 km
        </p>
      </div>

      {/* Alertas rápidos */}
      <div className="border-b border-white/5 px-4 py-3">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Alertas rápidos — 1 toque</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {ALERT_BUTTONS.map((a) => (
            <button
              key={a.type}
              onClick={() => sendAlert(a.type)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-extrabold transition active:scale-95 ${a.classes}`}
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} audioUrl={audioUrls[m.id]} />
        ))}
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-zinc-500">Canal silencioso por enquanto. Puxe conversa!</p>
        )}
      </div>

      {/* Composer + PTT */}
      <div className="border-t border-white/8 bg-[#0a0d12] px-4 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendText()}
            placeholder={`Mensagem no canal ${channel}…`}
            className="h-13 flex-1 rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400/50"
          />
          <button
            onClick={sendText}
            disabled={!text.trim()}
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/8 p-3.5 text-lime-300 transition active:scale-95 disabled:opacity-30"
            aria-label="Enviar mensagem"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex justify-center">
          <PttButton onSend={sendAudio} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, audioUrl }: { m: ChatMessage; audioUrl?: string }) {
  if (m.kind === "alerta") {
    const meta = ALERT_META[m.alertType ?? "risco"];
    const Icon = ALERT_ICONS[m.alertType ?? "risco"];
    return (
      <div className={`slide-up rounded-2xl border p-3.5 ${meta.bg} ${meta.border}`}>
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-black/25 ${meta.color}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-black tracking-wide uppercase ${meta.color}`}>{meta.label}</p>
            <p className="text-[11px] text-zinc-400">
              {m.senderNickname} • {m.neighborhood} • {clockTime(m.createdAt)}
            </p>
          </div>
          {m.alertType === "sos" && (
            <span className="animate-pulse rounded-md bg-red-500 px-2 py-1 text-[10px] font-black text-white">URGENTE</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-snug text-zinc-100">{m.content}</p>
      </div>
    );
  }

  return (
    <div className={`slide-up flex gap-2.5 ${m.isMe ? "flex-row-reverse" : ""}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-zinc-950 ${colorForId(m.courierId)}`}>
        {initialsOf(m.senderName)}
      </span>
      <div className={`max-w-[78%] ${m.isMe ? "text-right" : ""}`}>
        <p className="text-[11px] font-semibold text-zinc-500">
          {m.isMe ? "Você" : `${m.senderName.split(" ")[0]} “${m.senderNickname}”`} • {m.neighborhood} • {clockTime(m.createdAt)}
        </p>
        {m.kind === "audio" ? (
          <AudioBubble duration={m.audioDurationSec ?? 5} url={audioUrl} isMe={m.isMe} seedId={m.id} />
        ) : (
          <div
            className={`mt-1 inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm leading-snug ${
              m.isMe ? "rounded-br-md bg-lime-400 font-medium text-zinc-950" : "rounded-bl-md bg-white/6 text-zinc-100"
            }`}
          >
            {m.content}
          </div>
        )}
      </div>
    </div>
  );
}

function AudioBubble({ duration, url, isMe, seedId }: { duration: number; url?: string; isMe: boolean; seedId: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bars = Array.from({ length: 22 }, (_, i) => 6 + ((seedId * 7 + i * 13) % 14));

  const stopSim = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlaying(false);
    setProgress(0);
  };

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      stopSim();
      return;
    }
    setPlaying(true);
    if (url) {
      if (!audioRef.current) audioRef.current = new Audio(url);
      audioRef.current.currentTime = 0;
      audioRef.current.onended = () => stopSim();
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && duration > 0) setProgress(audioRef.current.currentTime / duration);
      };
      audioRef.current.play().catch(() => simulate());
    } else {
      simulate();
    }
  };

  const simulate = () => {
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const p = (Date.now() - started) / (duration * 1000);
      if (p >= 1) stopSim();
      else setProgress(p);
    }, 100);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return (
    <div
      className={`mt-1 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ${
        isMe ? "rounded-br-md bg-lime-400 text-zinc-950" : "rounded-bl-md bg-white/6 text-zinc-100"
      }`}
    >
      <button
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isMe ? "bg-zinc-950 text-lime-400" : "bg-lime-400 text-zinc-950"}`}
        aria-label={playing ? "Pausar áudio" : "Ouvir áudio"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <span className="flex h-6 items-center gap-[2.5px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i / bars.length <= progress ? (isMe ? "bg-zinc-950" : "bg-lime-300") : isMe ? "bg-zinc-950/30" : "bg-zinc-600"}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
      <span className="text-xs font-bold tabular-nums">0:{String(duration).padStart(2, "0")}</span>
    </div>
  );
}
