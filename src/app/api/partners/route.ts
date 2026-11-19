import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { ne } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { haversineKm } from "@/lib/domain";

export const dynamic = "force-dynamic";

/** Posição de GPS é considerada "ao vivo" por até 3 minutos */
const LIVE_MS = 3 * 60 * 1000;

type Row = typeof couriers.$inferSelect;

function livePosition(c: Row, now: number) {
  if (c.lastLat != null && c.lastLng != null && c.lastSeenAt && now - c.lastSeenAt.getTime() < LIVE_MS) {
    return { lat: c.lastLat, lng: c.lastLng };
  }
  return null;
}

export async function GET(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const now = Date.now();
  const myPos = livePosition(me, now) ?? { lat: me.baseLat, lng: me.baseLng };
  const partners = await db.select().from(couriers).where(ne(couriers.id, me.id));
  const result = partners
    .flatMap((p) => {
      const real = livePosition(p, now);
      // Só aparece no radar quem enviou GPS nos últimos minutos
      if (!real) return [];
      const pos = real;
      return [{
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        status: p.status,
        lat: pos.lat,
        lng: pos.lng,
        live: true,
        distanceKm: Math.round(haversineKm(myPos.lat, myPos.lng, pos.lat, pos.lng) * 10) / 10,
        rating: p.rating,
      }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({ partners: result });
}
