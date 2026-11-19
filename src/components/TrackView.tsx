"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false });

type Track = {
  code: string; status: string; storeName: string; clientName: string; deliveryAddress: string;
  pickup: { lat: number; lng: number }; delivery: { lat: number; lng: number };
  createdAt: string; acceptedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null;
  deliveryCode: string | null;
  courier: { firstName: string; vehicle: string; photoUrl: string | null; pos: { lat: number; lng: number; seenAt: string | null } | null } | null;
};

const STEPS = [
  { id: "available", label: "Pedido recebido", hint: "Procurando um entregador perto da loja" },
  { id: "accepted", label: "Entregador a caminho da loja", hint: "Ele vai retirar seu pedido" },
  { id: "picked_up", label: "Saiu para entrega", hint: "Seu pedido está indo até você" },
  { id: "delivered", label: "Entregue", hint: "Bom apetite! 😋" },
];

const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

export default function TrackView({ token }: { token: string }) {
  const [data, setData] = useState<Track | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/track/${token}`, { cache: "no-store" });
        const d = await res.json();
        if (!alive) return;
        if (!res.ok) setError(d.error ?? "Pedido não encontrado");
        else {
          setError("");
          setData(d);
        }
      } catch {
        /* sem internet: tenta de novo no próximo ciclo */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  if (error && !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 text-center">
        <div>
          <p className="text-4xl">📦</p>
          <p className="mt-2 text-lg font-bold text-zinc-900">{error}</p>
          <p className="mt-1 text-sm text-zinc-500">Confira o link com a loja.</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50">
        <LoaderCircle className="h-8 w-8 animate-spin text-zinc-400" />
      </main>
    );
  }

  const stepIdx = STEPS.findIndex((s) => s.id === data.status);
  const ended = data.status === "cancelled" || data.status === "expired";
  const times = [data.createdAt, data.acceptedAt, data.pickedUpAt, data.deliveredAt];

  return (
    <main className="min-h-dvh bg-zinc-50 pb-10 text-zinc-900">
      <div className="mx-auto max-w-[480px] px-4 pt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Acompanhe seu pedido</p>
        <h1 className="mt-0.5 font-display text-2xl font-black">{data.storeName}</h1>
        <p className="text-sm text-zinc-500">
          Pedido {data.code}
          {data.clientName ? ` • para ${data.clientName}` : ""}
        </p>

        {ended ? (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 text-center">
            <p className="text-lg font-bold">{data.status === "cancelled" ? "Pedido cancelado pela loja" : "Pedido encerrado"}</p>
            <p className="mt-1 text-sm text-zinc-500">Fale com a loja para mais informações.</p>
          </div>
        ) : (
          <>
            {data.status !== "delivered" && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <LiveMap pickup={data.pickup} delivery={data.delivery} courier={data.courier?.pos ?? null} height={260} />
              </div>
            )}

            {data.courier && data.status !== "delivered" && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                {data.courier.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.courier.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-xl">🛵</div>
                )}
                <div className="flex-1">
                  <p className="font-bold">{data.courier.firstName}</p>
                  <p className="text-xs text-zinc-500">
                    {data.courier.vehicle}
                    {data.courier.pos?.seenAt ? ` • posição de ${hhmm(data.courier.pos.seenAt)}` : ""}
                  </p>
                </div>
              </div>
            )}

            {data.deliveryCode && (
              <div className="mt-3 rounded-2xl border-2 border-dashed border-lime-500 bg-lime-50 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Código de entrega</p>
                <p className="mt-1 font-display text-4xl font-black tracking-[0.35em] text-zinc-900">{data.deliveryCode}</p>
                <p className="mt-1 text-xs text-zinc-600">Informe este código ao entregador só quando receber o pedido.</p>
              </div>
            )}

            <ol className="mt-4 space-y-0 rounded-2xl border border-zinc-200 bg-white p-4">
              {STEPS.map((s, i) => {
                const done = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={s.id} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className={`mt-0.5 h-4 w-4 rounded-full ${done ? "bg-lime-500" : "bg-zinc-200"} ${current ? "ring-4 ring-lime-200" : ""}`} />
                      {i < STEPS.length - 1 && <span className={`mt-1 w-0.5 flex-1 ${i < stepIdx ? "bg-lime-500" : "bg-zinc-200"}`} />}
                    </div>
                    <div className="-mt-0.5">
                      <p className={`text-[15px] font-bold ${done ? "text-zinc-900" : "text-zinc-400"}`}>
                        {s.label} {done && times[i] && <span className="text-xs font-normal text-zinc-400">• {hhmm(times[i])}</span>}
                      </p>
                      {current && <p className="text-xs text-zinc-500">{s.hint}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-center text-xs text-zinc-400">Entrega para: {data.deliveryAddress}</p>
          </>
        )}
        <p className="mt-6 text-center text-[11px] text-zinc-400">RotaLivre • atualiza sozinho a cada 10 s</p>
      </div>
    </main>
  );
}
