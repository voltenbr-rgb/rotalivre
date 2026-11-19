import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureSeeded, getSessionCourier } from "@/lib/seed";
import { generateOrder, haversineKm } from "@/lib/domain";

/** Raio do feed: só aparecem coletas até esta distância do entregador */
const FEED_RADIUS_KM = 25;
const LIVE_MS = 3 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * Feed aberto em tempo real:
 * - valores dos pedidos oscilam levemente a cada leitura (demanda dinâmica transparente)
 * - pedidos parados há +30min expiram; novos pedidos entram na praça
 */
export async function GET(req: Request) {
  await ensureSeeded();
  const now = Date.now();
  const me = await getSessionCourier(req);
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

  for (const o of available) {
    const ageMin = (now - o.createdAt.getTime()) / 60000;
    if (ageMin > 30) {
      updates.push(db.update(orders).set({ status: "expired" }).where(eq(orders.id, o.id)));
      continue;
    }
    // Oscilação de demanda em tempo real (mostrada ao entregador, sem caixa-preta)
    if (Math.random() < 0.45) {
      const delta = Math.round((Math.random() * 2.6 - 1.1) * 2) / 2;
      const next = Math.max(7, Math.round((o.valueNet + delta) * 2) / 2);
      if (next !== o.valueNet) {
        updates.push(db.update(orders).set({ valueNet: next }).where(eq(orders.id, o.id)));
        fresh.push({ ...o, valueNet: next });
        continue;
      }
    }
    fresh.push(o);
  }

  // Feed por região: mostra só o que está perto do entregador
  const nearby = fresh.filter(near);
  fresh.length = 0;
  fresh.push(...nearby);

  // Novos pedidos chegando na praça — a praça nunca fica vazia
  while (fresh.length < 6) {
    const [created] = await db.insert(orders).values(generateOrder(center)).returning();
    fresh.unshift(created);
  }
  if (fresh.length < 9 && Math.random() < 0.5) {
    const [created] = await db.insert(orders).values(generateOrder(center)).returning();
    fresh.unshift(created);
  }
  await Promise.all(updates);

  const result = fresh.slice(0, 12).map((o) => ({
    ...o,
    ratePerKm: Math.round((o.valueNet / o.distanceKm) * 100) / 100,
    createdAt: o.createdAt.toISOString(),
  }));

  return NextResponse.json({ orders: result });
}
