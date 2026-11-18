"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Radio } from "lucide-react";

interface Props {
  onSend: (durationSec: number, audioUrl: string | null) => void;
  size?: "lg" | "md";
  label?: string;
}

/**
 * Botão Push-to-Talk: segure para gravar (MediaRecorder real quando
 * disponível; simulação fiel quando o microfone é negado/indisponível).
 */
export default function PttButton({ onSend, size = "lg", label }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  useEffect(() => cleanup, []);

  const start = async (e: React.PointerEvent) => {
    e.preventDefault();
    if (recording) return;
    sendingRef.current = false;
    startRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 200);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        cleanup();
        if (!sendingRef.current) {
          sendingRef.current = true;
          onSend(dur, url);
        }
      };
      recorderRef.current = rec;
      rec.start();
    } catch {
      // Sem microfone: mantém o modo simulação (o timer define a duração)
      recorderRef.current = null;
    }
  };

  const stop = () => {
    if (!recording) return;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop(); // onstop envia
    } else {
      const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      cleanup();
      if (!sendingRef.current) {
        sendingRef.current = true;
        onSend(dur, null);
      }
    }
  };

  const dims = size === "lg" ? "h-16 px-6 text-base" : "h-12 px-4 text-sm";

  return (
    <div className="select-none">
      <button
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex touch-none items-center gap-3 rounded-full font-extrabold tracking-wide transition-all ${dims} ${
          recording
            ? "rec-pulse scale-[1.03] bg-red-500 text-white"
            : "bg-lime-400 text-zinc-950 shadow-[0_10px_30px_rgba(163,230,53,0.35)] active:scale-95"
        }`}
      >
        {recording ? <Radio className="h-6 w-6 animate-pulse" /> : <Mic className="h-6 w-6" />}
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
            Transmitindo… 0:{String(elapsed).padStart(2, "0")}
          </span>
        ) : (
          (label ?? "SEGURE PARA FALAR")
        )}
      </button>
      {recording && (
        <p className="mt-2 text-center text-[11px] font-semibold text-red-300">
          Solte para enviar ao canal
        </p>
      )}
    </div>
  );
}
