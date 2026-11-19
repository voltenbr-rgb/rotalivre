"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SEC = 60;

/**
 * Gravação de áudio no estilo WhatsApp (toque para gravar, botões para enviar/cancelar).
 * Usa o MediaRecorder do navegador; sem permissão de microfone a duração ainda é medida.
 */
export function useRecorder(onDone: (durationSec: number, audioUrl: string | null) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(true);
  const cancelRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  useEffect(() => cleanup, []);

  const finish = useCallback((cancel: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelRef.current = cancel;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (navigator.vibrate) navigator.vibrate(cancel ? [30, 30, 30] : 40);
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      cleanup();
      if (!cancel) onDoneRef.current(dur, null);
    }
  }, []);

  const start = useCallback(async () => {
    if (!finishedRef.current) return;
    finishedRef.current = false;
    cancelRef.current = false;
    startRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    if (navigator.vibrate) navigator.vibrate(30);
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
      if (sec >= MAX_SEC) finish(false);
    }, 250);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (finishedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const dur = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const cancelled = cancelRef.current;
        cleanup();
        if (!cancelled) onDoneRef.current(dur, URL.createObjectURL(blob));
      };
      recRef.current = rec;
      rec.start();
    } catch {
      recRef.current = null; // sem microfone: segue medindo a duração
    }
  }, [finish]);

  return {
    recording,
    elapsed,
    start,
    send: () => finish(false),
    cancel: () => finish(true),
  };
}
