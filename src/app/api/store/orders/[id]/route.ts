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

  // raise: aumenta o valor de um pedido sem entregador (+R$ 2 ou +R$ 5) e avisa de novo
  // relaunch: pedido cancelado/expirado volta a ficar disponível (pode subir o valor junto)
  if (body.action === "raise" || body.action === "relaunch") {
    const relaunch = body.action === "relaunch";
    const add = [0, 2, 5, 10].includes(Number(body.amount)) ? Number(body.amount) : relaunch ? 0 : 2;
    const [cur] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, parseInt(id)), eq(orders.storeId, st.id)))
      .limit(1);
    if (!cur) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const expired = cur.status === "available" && Date.now() - cur.createdAt.getTime() > 3 * 3600000;
    if (relaunch ? !(cur.status === "cancelled" || cur.status === "expired" || expired) : cur.status !== "available" || expired) {
      return NextResponse.json(
        { error: relaunch ? "Só dá para relançar pedido cancelado ou que ninguém aceitou" : "Esse pedido já foi aceito ou encerrado" },
        { status: 409 },
      );
    }
    const valueNet = Math.round((cur.valueNet + add) * 100) / 100;
    if (valueNet > 500) return NextResponse.json({ error: "Valor máximo é R$ 500" }, { status: 400 });
    await db
      .update(orders)
      .set(
        relaunch
          ? { valueNet, status: "available", createdAt: new Date(), renotifiedAt: null, courierId: null, acceptedAt: null, pickedUpAt: null, deliveryCodeAttempts: 0 }
          : { valueNet, renotifiedAt: new Date() },
      )
      .where(eq(orders.id, cur.id));
    inBackground(
      notifyCouriersNear(
        cur.pickupLat,
        cur.pickupLng,
        12,
        {
          title: relaunch
            ? `🛵 ${cur.establishment} pede entregador • ${fmtBRL(valueNet)}`
            : `💰 Valor aumentou: ${fmtBRL(valueNet)} • ${cur.establishment}`,
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
