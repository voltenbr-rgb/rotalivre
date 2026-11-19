import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couriers, orders, stores } from "@/db/schema";

export const dynamic = "force-dynamic";

const VEHICLE: Record<string, string> = { moto: "Moto", bicicleta: "Bicicleta", scooter: "Scooter", carro: "Carro" };

/** Página pública do cliente: acompanha o pedido pelo link, sem login */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{24}$/.test(token)) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  const [row] = await db
    .select({
      o: orders,
      store: { name: stores.name, category: stores.category },
      c: { name: couriers.name, nickname: couriers.nickname, vehicleType: couriers.vehicleType, photoUrl: couriers.photoUrl, lastLat: couriers.lastLat, lastLng: couriers.lastLng, lastSeenAt: couriers.lastSeenAt },
    })
    .from(orders)
    .leftJoin(stores, eq(stores.id, orders.storeId))
    .leftJoin(couriers, eq(couriers.id, orders.courierId))
    .where(eq(orders.publicToken, token))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  const { o, store, c } = row;
  const now = Date.now();
  const status =
    o.status === "available" && now - o.createdAt.getTime() > 3 * 3600000 ? "expired" : o.status;
  const active = status === "accepted" || status === "picked_up";
  const firstName = (c?.nickname || c?.name || "").trim().split(/\s+/)[0] || "Entregador";

  return NextResponse.json({
    code: o.code,
    status,
    storeName: store?.name ?? o.establishment,
    storeCategory: store?.category ?? o.establishmentType,
    clientName: (o.clientName || "").split(/\s+/)[0],
    deliveryAddress: o.deliveryAddress,
    pickup: { lat: o.pickupLat, lng: o.pickupLng },
    delivery: { lat: o.deliveryLat, lng: o.deliveryLng },
    createdAt: o.createdAt.toISOString(),
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    // O cliente informa este código ao entregador na hora da entrega
    deliveryCode: active ? o.deliveryCode : null,
    courier: c && o.courierId
      ? {
          firstName,
          vehicle: VEHICLE[c.vehicleType ?? ""] ?? "Veículo",
          photoUrl: c.photoUrl?.startsWith("data:image/") ? c.photoUrl : null,
          pos: active && c.lastLat != null && c.lastLng != null ? { lat: c.lastLat, lng: c.lastLng, seenAt: c.lastSeenAt?.toISOString() ?? null } : null,
        }
      : null,
  });
}
