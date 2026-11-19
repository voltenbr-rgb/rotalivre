"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudRainWind, Mic, Pause, Play, Send, ShieldExclamationPoint, Siren,
  Store, Trash2, TriangleExclamationPoint, X,
} from "lucide-react";
import type { ChatMessage, Courier } from "@/lib/types";
import { ALERT_META, clockTime } from "@/lib/format";
import { apiFetch, getToken } from "@/lib/session";
import { useRecorder } from "@/lib/useRecorder";

interface Props {
  courier: Courier;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

const ALERT_BUTTONS = [
  { type: "blitz", label: "Blitz", icon: ShieldExclamationPoint, color: "text-sky-300" },
  { type: "alagamento", label: "Alagamento", icon: CloudRainWind, color: "text-cyan-300" },
  { type: "risco", label: "Área de risco", icon: TriangleExclamationPoint, color: "text-amber-300" },
  { type: "restaurante", label: "Restaurante lento", icon: Store, color: "text-orange-300" },
  { type: "sos", label: "SOS", icon: Siren, color: "text-red-400" },
] as const;

const ALERT_ICONS: Record<string, typeof ShieldExclamationPoint> = {
  blitz: ShieldExclamationPoint, alagamento: CloudRainWind, risco: TriangleExclamationPoint, restaurante: Store, sos: Siren,
};

/* Cores do nome de quem enviou (como nos grupos do WhatsApp) */
const NAME_COLORS = ["text-lime-300", "text-sky-300", "text-amber-300", "text-pink-300", "text-teal-300", "text-orange-300", "text-violet-300"];

export default function RadioView({ courier, notify }: Props) {
  // "perto" = raio de 15 km da minha posição; "cidade" = cidade do cadastro
  const [scope, setScope] = useState<"perto" | "cidade">("perto");
  const [cityName, setCityName] = useState(courier.city || "Minha cidade");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/messages?scope=${scope}`);
      const data = await res.json();
      if (data.city) setCityName(data.city);
      const list: ChatMessage[] = data.messages ?? [];
      const newOnes = list.filter((m) => m.id > lastIdRef.current && !m.isMe);
      if (lastIdRef.current > 0 && newOnes.length > 0) {
        const last = newOnes[newOnes.length - 1];
        if (last.kind === "alerta") notify(`Alerta de ${last.senderNickname}: ${ALERT_META[last.alertType ?? "risco"]?.label}`, last.alertType === "sos" ? "sos" : "warn");
      }
      if (list.length) lastIdRef.current = Math.max(lastIdRef.current, list[list.length - 1].id);
      setMessages(list);
    } catch { /* mantém */ }
  }, [scope, notify]);

  useEffect(() => {
    lastIdRef.current = 0;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, scope]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await apiFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighborhood: courier.neighborhood, ...payload }),
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
    setAlertsOpen(false);
    const meta = ALERT_META[type];
    const content =
      type === "sos"
        ? "Preciso de ajuda agora! Pane/acidente. Quem estiver perto, por favor venha."
        : `${meta.label} em ${courier.neighborhood || "minha região"}. Fiquem atentos!`;
    await post({ kind: "alerta", alertType: type, content });
    notify(type === "sos" ? "SOS enviado para a rede" : "Alerta enviado", type === "sos" ? "sos" : "ok");
    if (navigator.vibrate) navigator.vibrate(type === "sos" ? [120, 60, 120] : 50);
  };

  const recorder = useRecorder(async (durationSec, audio) => {
    let audioB64: string | undefined;
    let audioMime: string | undefined;
    if (audio) {
      audioB64 = await blobToBase64(audio);
      audioMime = audio.type || "audio/webm";
    }
    const msg = await post({ kind: "audio", audioDurationSec: durationSec, content: "", audioB64, audioMime });
    if (!msg) notify("Não foi possível enviar o áudio", "warn");
  });

  const hasText = text.trim().length > 0;
  const time = `${Math.floor(recorder.elapsed / 60)}:${String(recorder.elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto flex h-full w-full max-w-[520px] flex-col bg-[#0b141a] lg:max-w-3xl">
      {/* Abas: perto de mim (raio) e minha cidade (cadastro) */}
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#111b21] px-3 py-2">
        {([
          { id: "perto", label: "Perto de mim" },
          { id: "cidade", label: cityName },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setScope(t.id)}
            className={`max-w-[50%] truncate rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              scope === t.id ? "bg-lime-400/15 text-lime-300" : "text-zinc-400"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-zinc-500">{scope === "perto" ? "raio de 15 km • 24 h" : "últimas 24 h"}</span>
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
        onClick={() => setAlertsOpen(false)}
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            m={m}
            showName={!m.isMe && (i === 0 || messages[i - 1].courierId !== m.courierId || messages[i - 1].kind === "alerta")}
          />
        ))}
        {messages.length === 0 && (
          <p className="mx-auto mt-10 w-fit rounded-lg bg-[#182229] px-3 py-1.5 text-center text-xs text-zinc-400">
            {scope === "perto" ? "Ninguém falou por perto nas últimas 24 h" : `Nenhuma mensagem em ${cityName} nas últimas 24 h`}
          </p>
        )}
      </div>

      {/* Menu de alertas */}
      {alertsOpen && (
        <div className="slide-up mx-3 mb-1 grid grid-cols-5 gap-1 rounded-2xl bg-[#1f2c34] p-2">
          {ALERT_BUTTONS.map((a) => (
            <button
              key={a.type}
              onClick={() => sendAlert(a.type)}
              className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold text-zinc-300 active:bg-white/5"
            >
              <a.icon className={`h-5 w-5 ${a.color}`} />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Barra de digitação */}
      <div className="flex items-end gap-2 bg-[#0b141a] px-2 pt-1 pb-2">
        {recorder.recording ? (
          <div className="flex h-11 flex-1 items-center gap-3 rounded-full bg-[#1f2c34] pr-4 pl-1">
            <button
              onClick={recorder.cancel}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 active:bg-white/10"
              aria-label="Cancelar áudio"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-semibold text-zinc-200 tabular-nums">{time}</span>
            <span className="truncate text-xs text-zinc-500">Gravando…</span>
          </div>
        ) : (
          <div className="flex min-h-11 flex-1 items-center rounded-full bg-[#1f2c34] pr-2 pl-1">
            <button
              onClick={() => setAlertsOpen((v) => !v)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${alertsOpen ? "text-amber-300" : "text-zinc-400"}`}
              aria-label="Enviar alerta"
            >
              {alertsOpen ? <X className="h-5 w-5" /> : <TriangleExclamationPoint className="h-5 w-5" />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendText()}
              onFocus={() => setAlertsOpen(false)}
              placeholder="Mensagem"
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-white placeholder-zinc-500 outline-none"
            />
          </div>
        )}

        <button
          onClick={recorder.recording ? recorder.send : hasText ? sendText : recorder.start}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950 transition active:scale-90"
          aria-label={recorder.recording || hasText ? "Enviar" : "Gravar áudio"}
        >
          {recorder.recording || hasText ? <Send className="ml-0.5 h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ m, showName }: { m: ChatMessage; showName: boolean }) {
  if (m.kind === "alerta") {
    const meta = ALERT_META[m.alertType ?? "risco"];
    const Icon = ALERT_ICONS[m.alertType ?? "risco"];
    return (
      <div className="slide-up flex justify-center py-1">
        <div className={`w-full max-w-[90%] rounded-xl border px-3 py-2 ${meta.bg} ${meta.border}`}>
          <p className={`flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase ${meta.color}`}>
            <Icon className="h-3.5 w-3.5" /> {meta.label}
            {m.alertType === "sos" && <span className="ml-auto animate-pulse rounded bg-red-500 px-1.5 text-[9px] text-white">URGENTE</span>}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-zinc-100">{m.content}</p>
          <p className="mt-1 text-right text-[10px] text-zinc-400">
            {m.isMe ? "Você" : m.senderNickname}
            {m.distanceKm != null && ` • a ${m.distanceKm.toString().replace(".", ",")} km`} • {clockTime(m.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  const nameColor = NAME_COLORS[m.courierId % NAME_COLORS.length];

  return (
    <div className={`slide-up flex ${m.isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-xl px-2.5 pt-1.5 pb-1 shadow-sm ${
          m.isMe ? "rounded-tr-sm bg-[#005c4b]" : "rounded-tl-sm bg-[#202c33]"
        }`}
      >
        {showName && (
          <p className={`text-[12px] font-bold ${nameColor}`}>
            {m.senderNickname || m.senderName.split(" ")[0]}
            {m.distanceKm != null && (
              <span className="ml-1.5 font-normal text-white/40">• a {m.distanceKm.toString().replace(".", ",")} km</span>
            )}
          </p>
        )}
        {m.kind === "audio" ? (
          <AudioBubble
            duration={m.audioDurationSec ?? 5}
            url={m.audioUrl ? `${m.audioUrl}?t=${encodeURIComponent(getToken() ?? "")}` : undefined}
            seedId={m.id}
          />
        ) : (
          <p className="pr-12 text-[14.5px] leading-snug break-words whitespace-pre-wrap text-zinc-100">{m.content}</p>
        )}
        <span className="absolute right-2 bottom-1 text-[10px] text-white/50">{clockTime(m.createdAt)}</span>
      </div>
    </div>
  );
}

function AudioBubble({ duration, url, seedId }: { duration: number; url?: string; seedId: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bars = Array.from({ length: 24 }, (_, i) => 5 + ((seedId * 7 + i * 13) % 13));

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlaying(false);
    setProgress(0);
  };

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      stop();
      return;
    }
    setPlaying(true);
    if (url) {
      if (!audioRef.current) audioRef.current = new Audio(url);
      audioRef.current.currentTime = 0;
      audioRef.current.onended = () => stop();
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && duration > 0) setProgress(audioRef.current.currentTime / duration);
      };
      audioRef.current.play().catch(() => {
        setPlaying(false);
        setUnavailable(true);
      });
    } else {
      setPlaying(false);
      setUnavailable(true);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const total = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <div className="flex min-w-[210px] items-center gap-2 pr-10 pb-2">
      <button onClick={toggle} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-200" aria-label={playing ? "Pausar" : "Ouvir"}>
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <span className="flex h-6 flex-1 items-center gap-[2px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[2.5px] rounded-full ${i / bars.length <= progress ? "bg-lime-300" : "bg-white/35"}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
      <span className="absolute bottom-1 left-12 text-[10px] text-white/50 tabular-nums">
        {unavailable ? "áudio indisponível" : total}
      </span>
    </div>
  );
}

/** Blob → base64 (sem o prefixo data:) para enviar o áudio ao servidor */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
