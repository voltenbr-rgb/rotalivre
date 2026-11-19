"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Package, Route, Store, User, Wallet, X } from "lucide-react";
import type { Order } from "@/lib/types";
import { fmtBRL, fmtKm, timeAgo } from "@/lib/format";

interface Props {
  order: Order;
  onAccept: (o: Order) => void;
  onDismiss: (o: Order) => void;
  disabled: boolean;
}

export default function OrderCard({ order, onAccept, onDismiss, disabled }: Props) {
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(order.valueNet);

  useEffect(() => {
    if (prevValue.current !== order.valueNet) {
      prevValue.current = order.valueNet;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 950);
      return () => clearTimeout(t);
    }
  }, [order.valueNet]);

  const gross = order.valueNet / 0.95;
  const fee = gross - order.valueNet;

  return (
    <article className="slide-up overflow-hidden rounded-3xl border border-white/8 bg-[#101319] shadow-lg shadow-black/30">
      {/* Cabeçalho do estabelecimento */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-white">
            {order.establishment}
            {order.storeId ? (
              <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-amber-300 uppercase">
                Loja
              </span>
            ) : null}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-zinc-400">
            <User className="h-3 w-3" /> Cliente: {order.clientName}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-md bg-white/6 px-2 py-1 text-[11px] font-bold text-zinc-300">{order.code}</span>
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-zinc-500">
            <Clock className="h-3 w-3" /> {timeAgo(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Valor líquido + taxa/km */}
      <div className="flex items-end justify-between px-4 pt-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Você recebe (líquido)</p>
          <p className={`inline-block px-1 font-display text-[34px] leading-none font-black text-emerald-400 tabular-nums ${flash ? "value-flash" : ""}`}>
            {fmtBRL(order.valueNet)}
          </p>
        </div>
        <div className="text-right">
          <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 text-xs font-extrabold text-lime-300 tabular-nums">
            {fmtBRL(order.ratePerKm)}/km
          </span>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Bruto {fmtBRL(gross)} • taxa 5% {fmtBRL(fee)}
          </p>
        </div>
      </div>

      {/* Rota coleta → entrega */}
      <div className="px-4 pt-3">
        <div className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/15" />
            <span className="my-1 w-px flex-1 border-l border-dashed border-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/15" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-amber-300/90 uppercase">Coleta • {order.pickupNeighborhood}</p>
              <p className="truncate text-[13px] text-zinc-300">{order.pickupAddress}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-emerald-300/90 uppercase">Entrega • {order.deliveryNeighborhood}</p>
              <p className="truncate text-[13px] text-zinc-300">{order.deliveryAddress}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metadados */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-xs font-semibold text-zinc-400">
        <span className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5 text-zinc-500" /> {fmtKm(order.distanceKm)} no total</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-zinc-500" /> ~{order.etaMinutes} min</span>
        <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-zinc-500" /> {order.itemsCount} {order.itemsCount > 1 ? "itens" : "item"}</span>
        <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-zinc-500" /> {order.paymentMethod}</span>
        {order.notes ? (
          <span className="basis-full rounded-xl bg-amber-400/8 px-2.5 py-1.5 text-[12px] text-amber-100/90">📝 {order.notes}</span>
        ) : null}
      </div>

      {/* Ações — toque grande, pensado para luva */}
      <div className="flex gap-2.5 p-4">
        <button
          onClick={() => onDismiss(order)}
          className="flex h-14 items-center gap-1.5 rounded-2xl border border-white/10 bg-white/4 px-4 text-sm font-bold text-zinc-400 transition active:scale-95"
        >
          <X className="h-4 w-4" /> Ignorar
        </button>
        <button
          onClick={() => onAccept(order)}
          disabled={disabled}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-lime-400 text-base font-black tracking-wide text-zinc-950 shadow-[0_10px_26px_rgba(163,230,53,0.3)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MapPin className="h-5 w-5" /> ACEITAR CORRIDA
        </button>
      </div>
      <p className="px-4 pb-3 text-center text-[10px] text-zinc-600">
        Recusar nunca gera punição. Você só roda no que vale a pena.
      </p>
    </article>
  );
}
