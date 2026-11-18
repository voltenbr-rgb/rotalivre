import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { ne } from "drizzle-orm";
import { getSessionCourier } from "@/lib/seed";
import { haversineKm } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getSessionCourier(req);
  const partners = await db.select().from(couriers).where(ne(couriers.id, me.id));
  const result = partners.map((p) => {
    // leve deriva de posição a cada leitura = radar "ao vivo"
    const lat = p.baseLat + (Math.random() - 0.5) * 0.004;
    const lng = p.baseLng + (Math.random() - 0.5) * 0.004;
    return {
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      status: p.status,
      lat,
      lng,
      distanceKm: Math.round(haversineKm(me.baseLat, me.baseLng, lat, lng) * 10) / 10,
      rating: p.rating,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
  return NextResponse.json({ partners: result });
}
