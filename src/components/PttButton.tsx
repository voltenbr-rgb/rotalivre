"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, X } from "lucide-react";

interface Props {
  onSend: (durationSec: number, audioUrl: string | null) => void;
  size?: "lg" | "md";
  label?: string;
}

/** Arrastar o dedo para o lado mais que isso (px) cancela a gravação */
const CANCEL_SWIPE_PX = 90;
/** Gravação máxima, para não esquecer o microfone ligado */
const MAX_SEC = 60;

/**
 * Botão de rádio (PTT) em modo "toque e toque":
 * - 1º toque: começa a gravar (fica vermelho)
 * - 2º toque: envia
 * - tocar no X ou arrastar o dedo para o lado: cancela
 */
export default function PttButton({ onSend, size = "lg", label }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dragX, setDragX] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const doneRef = useRef(false);
  const pointerStartX = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  useEffect(() => cleanup, []);

  const vibrate = (p: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p);
  };

  const begin = async () => {
    cancelledRef.current = false;
    doneRef.current = false;
    startRef.current = Date.now();
    setElapsed(0);
    setDragX(0);
    setRecording(true);
    vibrate(30);
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
      if (sec >= MAX_SEC) finish(false);
    }, 200);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Se cancelou/enviou enquanto o celular pedia permissão do microfone
      if (doneRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        const cancelled = cancelledRef.current;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        cleanup();
        if (!cancelled) onSend(dur, URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
    } catch {
      // Sem permissão de microfone: o timer ainda define a duração
      recorderRef.current = null;
    }
  };

  /** Encerra a gravação: envia (cancel=false) ou descarta (cancel=true) */
  function finish(cancel: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelledRef.current = cancel;
    setRecording(false);
    setDragX(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    vibrate(cancel ? [40, 40, 40] : 50);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop(); // onstop envia ou descarta
    } else {
      const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      cleanup();
      if (!cancel) onSend(dur, null);
    }
  }

  /* ---------- toque no botão principal ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pointerStartX.current = e.clientX;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!recording || pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    setDragX(Math.max(-140, Math.min(140, dx)));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const startX = pointerStartX.current;
    pointerStartX.current = null;
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (!recording) {
      begin();
      return;
    }
    // Arrastou para o lado: cancela. Toque simples: envia.
    if (Math.abs(dx) > CANCEL_SWIPE_PX) finish(true);
    else {
      setDragX(0);
      finish(false);
    }
  };

  const onPointerCancel = () => {
    pointerStartX.current = null;
    setDragX(0);
  };

  const dims = size === "lg" ? "h-16 px-6 text-base" : "h-12 px-4 text-sm";
  const willCancel = Math.abs(dragX) > CANCEL_SWIPE_PX;
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="flex select-none flex-col items-end">
      <div className="flex items-center gap-2">
        {recording && (
          <button
            onClick={() => finish(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#0b0e13]/90 text-zinc-200 shadow-xl backdrop-blur-md active:scale-95"
            aria-label="Cancelar gravação"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          style={recording ? { transform: `translateX(${dragX}px)` } : undefined}
          className={`flex touch-none items-center gap-3 rounded-full font-extrabold tracking-wide transition-colors ${dims} ${
            recording
              ? willCancel
                ? "bg-zinc-700 text-zinc-200"
                : "rec-pulse bg-red-500 text-white"
              : "bg-lime-400 text-zinc-950 shadow-[0_10px_30px_rgba(163,230,53,0.35)] active:scale-95"
          }`}
          aria-label={recording ? "Enviar áudio" : "Começar a gravar"}
        >
          {recording ? (
            willCancel ? <X className="h-6 w-6" /> : <Send className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
          {recording ? (
            <span className="flex items-center gap-2">
              <span className="flex h-5 items-end gap-[3px]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="eq-bar w-[3px] rounded bg-white"
                    style={{ height: `${10 + (i % 3) * 5}px`, animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </span>
              {willCancel ? "Solte para cancelar" : `${time} • Toque para enviar`}
            </span>
          ) : (
            (label ?? "TOQUE PARA FALAR")
          )}
        </button>
      </div>
      {recording && (
        <p className="mt-2 rounded-lg bg-black/60 px-2 py-1 text-center text-[11px] font-semibold text-red-200">
          Gravando… toque para enviar • X ou arraste para o lado para cancelar
        </p>
      )}
    </div>
  );
}
