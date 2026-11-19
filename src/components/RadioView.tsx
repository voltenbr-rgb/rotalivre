"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown, CloudRainWind, Mic, Moon, Sun, Pause, Play, Send, ShieldExclamationPoint, Siren,
  Store, Trash2, TriangleExclamationPoint, X,
} from "lucide-react";
import type { ChatMessage, Courier, CourierStatus } from "@/lib/types";
import { ALERT_META, STATUS_LABEL, clockTime } from "@/lib/format";
import { apiFetch, getToken } from "@/lib/session";
import { useRecorder } from "@/lib/useRecorder";

interface Props {
  courier: Courier;
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
  onStatusChange: (s: CourierStatus) => void;
}

/* Tema do rádio: escuro (padrão) ou claro, no estilo do WhatsApp */
const THEMES = {
  dark: {
    root: "bg-[#0b141a]",
    bar: "bg-[#111b21] border-white/5",
    tabOn: "bg-lime-400/15 text-lime-300",
    tabOff: "text-zinc-400",
    hint: "text-zinc-500",
    empty: "bg-[#182229] text-zinc-400",
    sheet: "bg-[#1f2c34]",
    sheetText: "text-zinc-300",
    input: "bg-[#1f2c34]",
    inputText: "text-white placeholder-zinc-500",
    icon: "text-zinc-400",
    mine: "bg-[#005c4b]",
    theirs: "bg-[#202c33]",
    msgText: "text-zinc-100",
    meta: "text-white/50",
    wave: "bg-white/35",
    waveOn: "bg-lime-300",
    play: "text-zinc-200",
    menu: "bg-[#0d1015] border-white/10",
  },
  light: {
    root: "bg-[#efeae2]",
    bar: "bg-[#f0f2f5] border-black/5",
    tabOn: "bg-emerald-600/10 text-emerald-700",
    tabOff: "text-zinc-500",
    hint: "text-zinc-500",
    empty: "bg-white text-zinc-500 shadow-sm",
    sheet: "bg-white shadow-lg",
    sheetText: "text-zinc-700",
    input: "bg-white shadow-sm",
    inputText: "text-zinc-900 placeholder-zinc-400",
    icon: "text-zinc-500",
    mine: "bg-[#d9fdd3]",
    theirs: "bg-white",
    msgText: "text-zinc-900",
    meta: "text-black/45",
    wave: "bg-black/25",
    waveOn: "bg-emerald-600",
    play: "text-zinc-600",
    menu: "bg-white border-black/10",
  },
};
type Theme = (typeof THEMES)["dark"];

const STATUS_OPTIONS: { value: CourierStatus; label: string; hint: string }[] = [
  { value: "online", label: "Online", hint: "Recebe corridas e avisos" },
  { value: "pausa", label: "Em pausa", hint: "Sem novas corridas" },
  { value: "offline", label: "Offline", hint: "Invisível para a rede" },
];

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
const NAME_COLORS_LIGHT = ["text-emerald-700", "text-sky-700", "text-amber-700", "text-pink-700", "text-teal-700", "text-orange-700", "text-violet-700"];

export default function RadioView({ courier, notify, onStatusChange }: Props) {
  // Tema claro/escuro do rádio, salvo no aparelho
  const [light, setLight] = useState(false);
  useEffect(() => {
    try {
      setLight(localStorage.getItem("rl_chat_light") === "1");
    } catch { /* ignore */ }
  }, []);
  const toggleTheme = () =>
    setLight((v) => {
      try {
        localStorage.setItem("rl_chat_light", v ? "0" : "1");
      } catch { /* ignore */ }
      return !v;
    });
  const T: Theme = light ? THEMES.light : THEMES.dark;
  const [statusOpen, setStatusOpen] = useState(false);
  const status = STATUS_LABEL[courier.status] ?? STATUS_LABEL.online;
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
    <div className={`mx-auto flex h-full w-full max-w-[520px] flex-col lg:max-w-3xl ${T.root}`}>
      {/* Barra do rádio: abas, status Online e tema */}
      <div className={`relative flex items-center gap-1 border-b px-2 py-2 ${T.bar}`}>
        {([
          { id: "perto", label: "Perto de mim" },
          { id: "cidade", label: cityName },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setScope(t.id)}
            className={`max-w-[34%] truncate rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              scope === t.id ? T.tabOn : T.tabOff
            }`}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.classes}`}
            aria-label="Mudar status"
          >
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            {status.label}
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${T.icon}`}
            aria-label={light ? "Rádio escuro" : "Rádio claro"}
          >
            {light ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {statusOpen && (
          <div className={`slide-up absolute top-full right-2 z-30 mt-1 w-52 overflow-hidden rounded-2xl border shadow-2xl ${T.menu}`}>
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setStatusOpen(false);
                  if (o.value !== courier.status) onStatusChange(o.value);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left ${courier.status === o.value ? (light ? "bg-black/5" : "bg-white/5") : ""}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_LABEL[o.value].dot}`} />
                <span>
                  <span className={`block text-[13px] font-bold ${light ? "text-zinc-900" : "text-white"}`}>{o.label}</span>
                  <span className={`block text-[11px] ${T.hint}`}>{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-3"
        onClick={() => {
          setAlertsOpen(false);
          setStatusOpen(false);
        }}
      >
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            m={m}
            showName={!m.isMe && (i === 0 || messages[i - 1].courierId !== m.courierId || messages[i - 1].kind === "alerta")}
            T={T}
            light={light}
          />
        ))}
        {messages.length === 0 && (
          <p className={`mx-auto mt-10 w-fit rounded-lg px-3 py-1.5 text-center text-xs ${T.empty}`}>
            {scope === "perto" ? "Ninguém falou por perto nas últimas 24 h" : `Nenhuma mensagem em ${cityName} nas últimas 24 h`}
          </p>
        )}
      </div>

      {/* Menu de alertas */}
      {alertsOpen && (
        <div className={`slide-up mx-3 mb-1 grid grid-cols-5 gap-1 rounded-2xl p-2 ${T.sheet}`}>
          {ALERT_BUTTONS.map((a) => (
            <button
              key={a.type}
              onClick={() => sendAlert(a.type)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ${T.sheetText}`}
            >
              <a.icon className={`h-5 w-5 ${a.color}`} />
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Barra de digitação */}
      <div className={`flex items-end gap-2 px-2 pt-1 pb-2 ${T.root}`}>
        {recorder.recording ? (
          <div className={`flex h-11 flex-1 items-center gap-3 rounded-full pr-4 pl-1 ${T.input}`}>
            <button
              onClick={recorder.cancel}
              className={`flex h-9 w-9 items-center justify-center rounded-full ${T.icon}`}
              aria-label="Cancelar áudio"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className={`text-sm font-semibold tabular-nums ${T.msgText}`}>{time}</span>
            <span className={`truncate text-xs ${T.hint}`}>Gravando…</span>
          </div>
        ) : (
          <div className={`flex min-h-11 flex-1 items-center rounded-full pr-2 pl-1 ${T.input}`}>
            <button
              onClick={() => setAlertsOpen((v) => !v)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${alertsOpen ? "text-amber-500" : T.icon}`}
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
              className={`h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none ${T.inputText}`}
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

function MessageBubble({ m, showName, T, light }: { m: ChatMessage; showName: boolean; T: Theme; light: boolean }) {
  if (m.kind === "alerta") {
    const meta = ALERT_META[m.alertType ?? "risco"];
    const Icon = ALERT_ICONS[m.alertType ?? "risco"];
    return (
      <div className="slide-up flex justify-center py-1">
        <div className={`w-full max-w-[90%] rounded-xl border px-3 py-2 ${meta.bg} ${meta.border} ${light ? "bg-white/80" : ""}`}>
          <p className={`flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase ${meta.color}`}>
            <Icon className="h-3.5 w-3.5" /> {meta.label}
            {m.alertType === "sos" && <span className="ml-auto animate-pulse rounded bg-red-500 px-1.5 text-[9px] text-white">URGENTE</span>}
          </p>
          <p className={`mt-1 text-[13px] leading-snug ${light ? "text-zinc-800" : "text-zinc-100"}`}>{m.content}</p>
          <p className={`mt-1 text-right text-[10px] ${light ? "text-zinc-500" : "text-zinc-400"}`}>
            {m.isMe ? "Você" : m.senderNickname}
            {m.distanceKm != null && ` • a ${m.distanceKm.toString().replace(".", ",")} km`} • {clockTime(m.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  const nameColor = (light ? NAME_COLORS_LIGHT : NAME_COLORS)[m.courierId % NAME_COLORS.length];

  return (
    <div className={`slide-up flex ${m.isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-xl px-2.5 pt-1.5 pb-1 shadow-sm ${
          m.isMe ? `rounded-tr-sm ${T.mine}` : `rounded-tl-sm ${T.theirs}`
        }`}
      >
        {showName && (
          <p className={`text-[12px] font-bold ${nameColor}`}>
            {m.senderNickname || m.senderName.split(" ")[0]}
            {m.distanceKm != null && (
              <span className={`ml-1.5 font-normal ${T.meta}`}>• a {m.distanceKm.toString().replace(".", ",")} km</span>
            )}
          </p>
        )}
        {m.kind === "audio" ? (
          <AudioBubble
            duration={m.audioDurationSec ?? 5}
            url={m.audioUrl ? `${m.audioUrl}?t=${encodeURIComponent(getToken() ?? "")}` : undefined}
            seedId={m.id}
            T={T}
          />
        ) : (
          <p className={`pr-12 text-[14.5px] leading-snug break-words whitespace-pre-wrap ${T.msgText}`}>{m.content}</p>
        )}
        <span className={`absolute right-2 bottom-1 text-[10px] ${T.meta}`}>{clockTime(m.createdAt)}</span>
      </div>
    </div>
  );
}

function AudioBubble({ duration, url, seedId, T }: { duration: number; url?: string; seedId: number; T: Theme }) {
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
      <button onClick={toggle} className={`flex h-8 w-8 shrink-0 items-center justify-center ${T.play}`} aria-label={playing ? "Pausar" : "Ouvir"}>
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <span className="flex h-6 flex-1 items-center gap-[2px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[2.5px] rounded-full ${i / bars.length <= progress ? T.waveOn : T.wave}`}
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
      <span className={`absolute bottom-1 left-12 text-[10px] tabular-nums ${T.meta}`}>
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
