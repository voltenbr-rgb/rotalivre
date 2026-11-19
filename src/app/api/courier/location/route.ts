import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionCourier } from "@/lib/seed";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Recebe a posição real do GPS do celular do entregador.
 * O app envia a cada ~15 s ou a cada ~30 m percorridos.
 */
export async function POST(req: Request) {
  const me = await getSessionCourier(req);
  const body = await req.json().catch(() => ({}));
  const lat = num(body.lat);
  const lng = num(body.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
  }
  const accuracy = num(body.accuracy);
  const heading = num(body.heading);
  const speed = num(body.speedKmh);

  await db
    .update(couriers)
    .set({
      lastLat: lat,
      lastLng: lng,
      lastAccuracyM: accuracy === null ? null : Math.round(accuracy),
      lastHeading: heading,
      lastSpeedKmh: speed === null ? null : Math.round(speed * 10) / 10,
      lastSeenAt: new Date(),
    })
    .where(eq(couriers.id, me.id));

  return NextResponse.json({ ok: true });
}
