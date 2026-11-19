import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { ne } from "drizzle-orm";
import { getSessionCourier } from "@/lib/seed";
import { haversineKm, MAIN_BASE } from "@/lib/domain";

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
  const now = Date.now();
  const myPos = livePosition(me, now) ?? { lat: me.baseLat, lng: me.baseLng };
  const partners = await db.select().from(couriers).where(ne(couriers.id, me.id));
  // Parceiros de demonstração acompanham o entregador quando ele está longe de SP
  const meLive = livePosition(me, now);
  const shift = meLive && haversineKm(meLive.lat, meLive.lng, MAIN_BASE.lat, MAIN_BASE.lng) > 60
    ? { lat: meLive.lat - MAIN_BASE.lat, lng: meLive.lng - MAIN_BASE.lng }
    : { lat: 0, lng: 0 };

  const result = partners
    .flatMap((p) => {
      const real = livePosition(p, now);
      // Parceiros reais sem GPS recente não aparecem no radar.
      // Parceiros de demonstração (sem e-mail) seguem com a deriva simulada.
      const isDemo = !p.email;
      if (!real && !isDemo) return [];
      const pos = real ?? {
        lat: p.baseLat + shift.lat + (Math.random() - 0.5) * 0.004,
        lng: p.baseLng + shift.lng + (Math.random() - 0.5) * 0.004,
      };
      return [{
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        status: p.status,
        lat: pos.lat,
        lng: pos.lng,
        live: !!real,
        distanceKm: Math.round(haversineKm(myPos.lat, myPos.lng, pos.lat, pos.lng) * 10) / 10,
        rating: p.rating,
      }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({ partners: result });
}
