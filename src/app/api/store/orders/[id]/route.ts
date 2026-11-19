import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSessionStore, unauthorized } from "@/lib/auth";
import { completeDelivery } from "@/lib/delivery";
import { fmtBRL, fmtKm } from "@/lib/format";
import { inBackground, notifyCouriersNear } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Loja cancela um pedido que ainda ninguém aceitou */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const { id } = await params;
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, parseInt(id)), eq(orders.storeId, st.id), eq(orders.status, "available")))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Só dá para cancelar pedido que ainda não foi aceito" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

/** Loja confirma a entrega manualmente (ex.: cliente sem o código ou entregador errou 5 vezes) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Pedido parado: loja aumenta o valor em R$ 2 e avisa de novo os entregadores
  if (body.action === "raise") {
    const [cur] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, parseInt(id)), eq(orders.storeId, st.id), eq(orders.status, "available")))
      .limit(1);
    if (!cur) return NextResponse.json({ error: "Esse pedido já foi aceito ou encerrado" }, { status: 409 });
    const valueNet = Math.round((cur.valueNet + 2) * 100) / 100;
    if (valueNet > 500) return NextResponse.json({ error: "Valor máximo é R$ 500" }, { status: 400 });
    await db
      .update(orders)
      .set({ valueNet, renotifiedAt: new Date() })
      .where(and(eq(orders.id, cur.id), eq(orders.status, "available")));
    inBackground(
      notifyCouriersNear(
        cur.pickupLat,
        cur.pickupLng,
        12,
        {
          title: `💰 Valor aumentou: ${fmtBRL(valueNet)} • ${cur.establishment}`,
          body: `${cur.pickupNeighborhood || "Coleta"} → ${cur.deliveryNeighborhood || cur.deliveryAddress} • ${fmtKm(cur.distanceKm)}`,
          url: "/",
          tag: "corrida",
        },
        { respectGap: false, vehicles: cur.acceptedVehicles ?? "todos" },
      ),
    );
    return NextResponse.json({ ok: true, valueNet });
  }

  if (body.action !== "confirm_delivered") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, parseInt(id)), eq(orders.storeId, st.id)))
    .limit(1);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (!order.courierId || (order.status !== "accepted" && order.status !== "picked_up")) {
    return NextResponse.json({ error: "Só dá para confirmar pedido que está com um entregador" }, { status: 409 });
  }
  await completeDelivery(order, order.courierId);
  return NextResponse.json({ ok: true });
}
