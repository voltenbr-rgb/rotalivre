"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, LocateFixed, Send } from "lucide-react";

const PointPicker = dynamic(() => import("./PointPicker"), { ssr: false });

type Info = {
  storeName: string;
  storePos: { lat: number; lng: number } | null;
  status: "pendente" | "recebido" | "expirado";
  sent: { lat: number; lng: number; reference: string; clientName: string } | null;
};
type Pt = { lat: number; lng: number };

/** Página do cliente: "Estou aqui" → manda a localização direto para o pedido da loja */
export default function ClientLocation({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [pos, setPos] = useState<Pt | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gps, setGps] = useState<"idle" | "busy" | "denied">("idle");
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/loc/${token}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error ?? "Link inválido");
        else {
          setInfo(d);
          if (d.sent) {
            setPos({ lat: d.sent.lat, lng: d.sent.lng });
            setReference(d.sent.reference ?? "");
            setName(d.sent.clientName ?? "");
          }
        }
      })
      .catch(() => setError("Sem conexão. Tente de novo."));
  }, [token]);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGps("denied");
      return;
    }
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAccuracy(p.coords.accuracy);
        setGps("idle");
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const send = async () => {
    if (!pos) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/loc/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pos, accuracy, reference, clientName: name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "Não foi possível enviar");
      else setDone(true);
    } catch {
      setError("Sem conexão. Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-zinc-50 pb-10 text-zinc-900">
      <div className="mx-auto max-w-[480px] px-4 pt-6">{children}</div>
      <p className="mt-6 text-center text-[11px] text-zinc-400">RotaLivre</p>
    </main>
  );

  if (error && !info) {
    return shell(
      <div className="mt-16 text-center">
        <p className="text-4xl">📍</p>
        <p className="mt-2 text-lg font-bold">{error}</p>
        <p className="mt-1 text-sm text-zinc-500">Peça um novo link para a loja.</p>
      </div>,
    );
  }
  if (!info) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50">
        <LoaderCircle className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    );
  }
  if (info.status === "expirado") {
    return shell(
      <div className="mt-16 text-center">
        <p className="text-4xl">⌛</p>
        <p className="mt-2 text-lg font-bold">Este link expirou</p>
        <p className="mt-1 text-sm text-zinc-500">Peça um novo link para {info.storeName}.</p>
      </div>,
    );
  }
  if (done) {
    return shell(
      <div className="mt-16 text-center">
        <CircleCheck className="mx-auto h-16 w-16 text-lime-500" />
        <p className="mt-3 text-xl font-black">Localização enviada!</p>
        <p className="mt-1 text-sm text-zinc-500">{info.storeName} já recebeu o ponto da entrega. Pode voltar para o WhatsApp.</p>
        <button onClick={() => setDone(false)} className="mt-6 text-sm font-bold text-zinc-500 underline">
          Corrigir a localização
        </button>
      </div>,
    );
  }

  return shell(
    <>
      <p className="text-xs font-bold tracking-wider text-zinc-400 uppercase">Localização para entrega</p>
      <h1 className="mt-0.5 font-display text-2xl font-black">{info.storeName}</h1>
      <p className="mt-1 text-sm text-zinc-500">Mostre onde entregar seu pedido. É rapidinho.</p>

      <button
        onClick={locate}
        disabled={gps === "busy"}
        className="mt-5 flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-lime-500 text-lg font-black text-white shadow-[0_12px_28px_rgba(132,204,22,0.35)] active:scale-[0.98] disabled:opacity-70"
      >
        {gps === "busy" ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <LocateFixed className="h-6 w-6" />}
        {pos ? "USAR MINHA LOCALIZAÇÃO DE NOVO" : "📍 ESTOU AQUI"}
      </button>
      {gps === "denied" && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[13px] leading-snug text-amber-800">
          Não consegui pegar sua localização. Ative o GPS e permita a localização no navegador, ou toque no mapa abaixo no lugar da entrega.
        </p>
      )}

      <p className="mt-5 text-[13px] font-bold text-zinc-600">
        {pos ? "Confira o pino. Se precisar, toque no lugar exato:" : "Ou toque no mapa no lugar da entrega:"}
      </p>
      <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200">
        <PointPicker
          value={pos}
          onChange={(p) => {
            setPos(p);
            setAccuracy(null);
          }}
          anchor={info.storePos}
          pinEmoji="🏠"
          height={300}
        />
      </div>
      {pos && accuracy != null && accuracy > 60 && (
        <p className="mt-1.5 text-[12px] text-amber-700">Precisão do GPS: cerca de {Math.round(accuracy)} m. Se o pino não estiver certo, toque no mapa para ajustar.</p>
      )}

      <div className="mt-4 space-y-2.5">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Ponto de referência (ex.: casa azul, portão preto)"
          className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-[15px] outline-none focus:border-lime-500"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-[15px] outline-none focus:border-lime-500"
        />
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        onClick={send}
        disabled={!pos || sending}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-base font-black text-white active:scale-[0.98] disabled:opacity-40"
      >
        {sending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} ENVIAR LOCALIZAÇÃO PARA A LOJA
      </button>
      <p className="mt-2 text-center text-[11px] text-zinc-400">Sua localização é usada só para esta entrega.</p>
    </>,
  );
}
