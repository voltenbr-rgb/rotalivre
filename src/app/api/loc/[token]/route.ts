import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locationRequests, stores } from "@/db/schema";
import { reverseGeocode } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** O link vale 24 h; dá para reenviar a localização por até 2 h depois do primeiro envio */
const LINK_TTL = 24 * 3600 * 1000;
const RESEND_TTL = 2 * 3600 * 1000;

async function find(token: string) {
  if (!/^[a-f0-9]{24}$/.test(token)) return null;
  const [row] = await db
    .select({ r: locationRequests, store: { name: stores.name, lat: stores.lat, lng: stores.lng, category: stores.category } })
    .from(locationRequests)
    .leftJoin(stores, eq(stores.id, locationRequests.storeId))
    .where(eq(locationRequests.token, token))
    .limit(1);
  return row ?? null;
}

const expired = (r: typeof locationRequests.$inferSelect) =>
  Date.now() - r.createdAt.getTime() > LINK_TTL ||
  (r.receivedAt != null && Date.now() - r.receivedAt.getTime() > RESEND_TTL);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await find(token);
  if (!row) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  return NextResponse.json({
    storeName: row.store?.name || "a loja",
    storeCategory: row.store?.category ?? "",
    storePos: row.store?.lat != null && row.store?.lng != null ? { lat: row.store.lat, lng: row.store.lng } : null,
    status: expired(row.r) ? "expirado" : row.r.status,
    sent: row.r.lat != null ? { lat: row.r.lat, lng: row.r.lng, reference: row.r.reference, clientName: row.r.clientName } : null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await find(token);
  if (!row) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  if (expired(row.r)) return NextResponse.json({ error: "Este link expirou. Peça um novo para a loja." }, { status: 410 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Localização inválida" }, { status: 400 });
  }
  const accuracy = Number.isFinite(Number(body.accuracy)) ? Math.round(Number(body.accuracy)) : null;
  const place = await reverseGeocode({ lat, lng });

  await db
    .update(locationRequests)
    .set({
      status: "recebido",
      lat, lng, accuracy,
      address: place?.address ?? "",
      neighborhood: place?.neighborhood ?? "",
      reference: String(body.reference ?? "").trim().slice(0, 160),
      clientName: String(body.clientName ?? "").trim().slice(0, 60),
      receivedAt: row.r.receivedAt ?? new Date(),
    })
    .where(eq(locationRequests.id, row.r.id));
  return NextResponse.json({ ok: true });
}
