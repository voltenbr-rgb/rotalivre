import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { haversineKm } from "@/lib/domain";
import { forCourier } from "@/lib/delivery";

/** Raio do feed: só aparecem coletas até esta distância do entregador */
const FEED_RADIUS_KM = 25;
const LIVE_MS = 3 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * Feed aberto em tempo real:
 * - pedidos parados há +3 h expiram
 * - mostra só pedidos reais, lançados pelas lojas cadastradas
 */
export async function GET(req: Request) {
  const now = Date.now();
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const live =
    me.lastLat != null && me.lastLng != null && me.lastSeenAt && now - me.lastSeenAt.getTime() < LIVE_MS;
  // Centro do feed: GPS real (se recente) ou a base cadastrada
  const center = live ? { lat: me.lastLat!, lng: me.lastLng! } : { lat: me.baseLat, lng: me.baseLng };
  const near = (o: { pickupLat: number; pickupLng: number }) =>
    haversineKm(center.lat, center.lng, o.pickupLat, o.pickupLng) <= FEED_RADIUS_KM;
  const available = await db
    .select()
    .from(orders)
    .where(eq(orders.status, "available"))
    .orderBy(desc(orders.createdAt));

  const updates: Promise<unknown>[] = [];
  const fresh: typeof available = [];

  // Veículo do entregador precisa estar entre os aceitos pela loja
  const myVehicle = me.vehicleType || "moto";
  const vehicleOk = (o: (typeof available)[number]) =>
    !o.acceptedVehicles || o.acceptedVehicles === "todos" || o.acceptedVehicles.split(",").includes(myVehicle);

  for (const o of available) {
    // Só pedidos lançados por lojas cadastradas (os fictícios de teste foram desligados)
    if (!o.storeId) continue;
    const ageMin = (now - o.createdAt.getTime()) / 60000;
    // Pedido de teste expira em 30 min; pedido de loja real, em 3 h
    if (ageMin > (o.storeId ? 180 : 30)) {
      updates.push(db.update(orders).set({ status: "expired" }).where(eq(orders.id, o.id)));
      continue;
    }
    fresh.push(o);
  }

  // Feed por região: mostra só o que está perto do entregador
  const nearby = fresh.filter((o) => near(o) && vehicleOk(o));
  fresh.length = 0;
  fresh.push(...nearby);

  await Promise.all(updates);

  // Pedidos de lojas reais primeiro
  fresh.sort((a, b) => Number(!!b.storeId) - Number(!!a.storeId));
  const result = fresh.slice(0, 12).map((o) =>
    forCourier({
      ...o,
      ratePerKm: Math.round((o.valueNet / o.distanceKm) * 100) / 100,
      createdAt: o.createdAt.toISOString(),
    }),
  );

  return NextResponse.json({ orders: result });
}
