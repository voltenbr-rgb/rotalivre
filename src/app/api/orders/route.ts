import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { generateOrder, haversineKm } from "@/lib/domain";

/** Raio do feed: só aparecem coletas até esta distância do entregador */
const FEED_RADIUS_KM = 25;
const LIVE_MS = 3 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * Feed aberto em tempo real:
 * - pedidos parados há +30min expiram
 * - PROVISÓRIO: enquanto não há lançamento de pedidos, pedidos de teste são
 *   gerados ao redor do entregador para testar o feed e o mapa
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

  for (const o of available) {
    const ageMin = (now - o.createdAt.getTime()) / 60000;
    if (ageMin > 30) {
      updates.push(db.update(orders).set({ status: "expired" }).where(eq(orders.id, o.id)));
      continue;
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
