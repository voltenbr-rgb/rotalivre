import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { couriers, orders } from "@/db/schema";
import { getSessionStore, unauthorized } from "@/lib/auth";
import { haversineKm, orderCode } from "@/lib/domain";
import { fmtBRL, fmtKm } from "@/lib/format";
import { inBackground, notifyCouriersNear } from "@/lib/push";
import { newDeliveryCode, newPublicToken } from "@/lib/delivery";

export const dynamic = "force-dynamic";

const VEHICLES = ["moto", "bicicleta", "scooter", "carro"];
/** Avisa entregadores com o sino ligado a até 6 km da loja */
const NOTIFY_KM = 6;
/** Pedido parado: depois de 5 min sem ninguém aceitar, avisa de novo num raio maior */
const STALE_MIN = 5;
const RENOTIFY_KM = 12;


function iso(d: Date | null) {
  return d ? d.toISOString() : null;
}

/** Pedidos da loja (últimos 7 dias), com quem aceitou */
export async function GET(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      o: orders,
      c: {
        name: couriers.name, nickname: couriers.nickname, phone: couriers.phone, vehicleType: couriers.vehicleType,
        lastLat: couriers.lastLat, lastLng: couriers.lastLng, lastSeenAt: couriers.lastSeenAt,
      },
    })
    .from(orders)
    .leftJoin(couriers, eq(couriers.id, orders.courierId))
    .where(and(eq(orders.storeId, st.id), gte(orders.createdAt, since)))
    .orderBy(desc(orders.createdAt))
    .limit(60);

  const now = Date.now();

  // Pedidos sem link de acompanhamento (anteriores a esta versão) ganham um agora
  for (const { o } of rows) {
    if (!o.publicToken && (o.status === "available" || o.status === "accepted" || o.status === "picked_up")) {
      o.publicToken = newPublicToken();
      await db.update(orders).set({ publicToken: o.publicToken }).where(and(eq(orders.id, o.id), isNull(orders.publicToken)));
    }
  }

  // Pedido que ninguém pegou em 5 min: avisa de novo, num raio de 12 km (uma vez)
  for (const { o } of rows) {
    const age = now - o.createdAt.getTime();
    if (o.status === "available" && !o.renotifiedAt && age > STALE_MIN * 60000 && age < 3 * 3600000) {
      const [marked] = await db
        .update(orders)
        .set({ renotifiedAt: new Date() })
        .where(and(eq(orders.id, o.id), isNull(orders.renotifiedAt), eq(orders.status, "available")))
        .returning({ id: orders.id });
      if (marked) {
        o.renotifiedAt = new Date();
        inBackground(
          notifyCouriersNear(
            o.pickupLat,
            o.pickupLng,
            RENOTIFY_KM,
            {
              title: `⏳ Ainda sem entregador • ${o.establishment} • ${fmtBRL(o.valueNet)}`,
              body: `${o.pickupNeighborhood || "Coleta"} → ${o.deliveryNeighborhood || o.deliveryAddress} • ${fmtKm(o.distanceKm)}`,
              url: "/",
              tag: "corrida",
            },
            { respectGap: false, vehicles: o.acceptedVehicles ?? "todos" },
          ),
        );
      }
    }
  }

  const list = rows.map(({ o, c }) => ({
    ...o,
    renotifiedAt: iso(o.renotifiedAt),
    waitingMinutes: o.status === "available" ? Math.floor((now - o.createdAt.getTime()) / 60000) : 0,
    // Pedido de loja disponível há mais de 3 h é considerado expirado
    status: o.status === "available" && now - o.createdAt.getTime() > 3 * 3600 * 1000 ? "expired" : o.status,
    ratePerKm: Math.round((o.valueNet / o.distanceKm) * 100) / 100,
    createdAt: o.createdAt.toISOString(),
    acceptedAt: iso(o.acceptedAt),
    pickedUpAt: iso(o.pickedUpAt),
    deliveredAt: iso(o.deliveredAt),
    courierName: c?.name ?? null,
    courierNickname: c?.nickname ?? null,
    courierPhone: c?.phone ?? null,
    courierVehicle: c?.vehicleType ?? null,
    // Posição ao vivo do entregador só enquanto ele está com o pedido
    courierPos:
      c && (o.status === "accepted" || o.status === "picked_up") && c.lastLat != null && c.lastLng != null
        ? { lat: c.lastLat, lng: c.lastLng, seenAt: iso(c.lastSeenAt) }
        : null,
  }));
  return NextResponse.json({ orders: list });
}

/** Loja lança um pedido: aparece no feed/radar dos entregadores da região e dispara o aviso */
export async function POST(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  if (st.lat == null || st.lng == null || !st.name) {
    return NextResponse.json({ error: "Complete o nome e a localização da loja antes de lançar pedidos" }, { status: 400 });
  }
  const b = await req.json().catch(() => ({}));
  const clientName = String(b.clientName ?? "").trim().slice(0, 80);
  const deliveryAddress = String(b.deliveryAddress ?? "").trim().slice(0, 160);
  const deliveryLat = Number(b.deliveryLat);
  const deliveryLng = Number(b.deliveryLng);
  const valueNet = Math.round(Number(b.valueNet) * 100) / 100;
  if (!clientName) return NextResponse.json({ error: "Informe o nome do cliente" }, { status: 400 });
  if (!deliveryAddress) return NextResponse.json({ error: "Informe o endereço de entrega" }, { status: 400 });
  if (!Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
    return NextResponse.json({ error: "Marque no mapa o ponto de entrega" }, { status: 400 });
  }
  if (!Number.isFinite(valueNet) || valueNet < 3 || valueNet > 500) {
    return NextResponse.json({ error: "Valor da entrega entre R$ 3 e R$ 500" }, { status: 400 });
  }
  const vehicles = Array.isArray(b.acceptedVehicles)
    ? b.acceptedVehicles.filter((v: unknown) => typeof v === "string" && VEHICLES.includes(v))
    : [];
  const acceptedVehicles = vehicles.length === 0 || vehicles.length === VEHICLES.length ? "todos" : vehicles.join(",");

  const straight = haversineKm(st.lat, st.lng, deliveryLat, deliveryLng);
  if (straight > 60) return NextResponse.json({ error: "Ponto de entrega muito longe da loja" }, { status: 400 });
  const distanceKm = Math.max(0.5, Math.round(straight * 1.3 * 10) / 10);

  const [created] = await db
    .insert(orders)
    .values({
      code: orderCode(),
      clientName,
      clientPhone: String(b.clientPhone ?? "").trim().slice(0, 30),
      establishment: st.name,
      establishmentType: st.category || "Restaurante",
      pickupAddress: st.address || "Endereço da loja",
      pickupNeighborhood: st.neighborhood || st.city || "",
      pickupLat: st.lat,
      pickupLng: st.lng,
      deliveryAddress,
      deliveryNeighborhood: String(b.deliveryNeighborhood ?? "").trim().slice(0, 60),
      deliveryLat,
      deliveryLng,
      distanceKm,
      valueNet,
      etaMinutes: Math.round(8 + distanceKm * 3.2),
      itemsCount: Math.min(50, Math.max(1, parseInt(b.itemsCount) || 1)),
      paymentMethod: ["Pix", "Cartão", "Dinheiro", "Já pago"].includes(b.paymentMethod) ? b.paymentMethod : "Pix",
      notes: String(b.notes ?? "").trim().slice(0, 240),
      storeId: st.id,
      acceptedVehicles,
      deliveryCode: newDeliveryCode(),
      publicToken: newPublicToken(),
      status: "available",
    })
    .returning();

  inBackground(
    notifyCouriersNear(
      st.lat,
      st.lng,
      NOTIFY_KM,
      {
        title: `🛵 ${st.name} pede entregador • ${fmtBRL(valueNet)}`,
        body: `${st.neighborhood || st.city || "Coleta"} → ${created.deliveryNeighborhood || deliveryAddress} • ${fmtKm(distanceKm)}`,
        url: "/",
        tag: "corrida",
      },
      { respectGap: false, vehicles: acceptedVehicles },
    ),
  );

  return NextResponse.json({ order: { ...created, createdAt: created.createdAt.toISOString() } });
}
