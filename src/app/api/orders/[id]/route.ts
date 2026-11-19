import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, couriers, orderCancellations } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { completeDelivery, forCourier, MAX_CODE_ATTEMPTS, RATING_CANCEL_PENALTY, RATING_MIN } from "@/lib/delivery";
import { fmtBRL, fmtKm } from "@/lib/format";
import { inBackground, notifyCouriersNear } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Ações do entregador sobre um pedido:
 * - accept: pega o pedido (só se ainda estiver disponível)
 * - pickup: confirma a coleta (só quem aceitou)
 * - deliver: fecha a entrega (só quem aceitou). Pedido de loja exige o código
 *   de 4 dígitos que o cliente recebeu da loja.
 * - dismiss: some só do feed deste entregador (não afeta os outros)
 * - cancel: entregador desiste da corrida aceita. Conta como cancelamento na nota,
 *   o pedido volta para os outros entregadores e a loja é avisada.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orderId = parseInt(id);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const main = await getSessionCourier(req);
  if (!main) return unauthorized();

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  if (action === "accept") {
    if (order.status !== "available") {
      return NextResponse.json({ error: "Pedido já foi aceito por outro entregador" }, { status: 409 });
    }
    const vehicles = order.acceptedVehicles;
    if (vehicles && vehicles !== "todos" && !vehicles.split(",").includes(main.vehicleType || "moto")) {
      return NextResponse.json({ error: "Este pedido não aceita o seu tipo de veículo" }, { status: 403 });
    }
    const active = await db
      .select()
      .from(orders)
      .where(and(eq(orders.courierId, main.id), inArray(orders.status, ["accepted", "picked_up"])));
    if (active.length > 0) {
      return NextResponse.json({ error: "Você já tem uma entrega em andamento" }, { status: 409 });
    }
    // Só aceita se ainda estiver disponível (evita dois entregadores no mesmo pedido)
    const [updated] = await db
      .update(orders)
      .set({ status: "accepted", courierId: main.id, acceptedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "available")))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Pedido já foi aceito por outro entregador" }, { status: 409 });
    }
    await db.update(couriers).set({ status: "em_entrega" }).where(eq(couriers.id, main.id));
    return NextResponse.json({ order: serialize(updated) });
  }

  if (action === "dismiss") {
    // Pedido de loja continua no feed dos outros; o app esconde só para este entregador
    if (!order.storeId && order.status === "available") {
      await db.update(orders).set({ status: "dismissed" }).where(eq(orders.id, orderId));
    }
    return NextResponse.json({ ok: true });
  }

  // Daqui em diante, só quem aceitou o pedido pode mexer nele
  if (order.courierId !== main.id) {
    return NextResponse.json({ error: "Este pedido não é seu" }, { status: 403 });
  }

  if (action === "pickup") {
    if (order.status !== "accepted") {
      return NextResponse.json({ error: "Coleta já confirmada ou pedido encerrado" }, { status: 409 });
    }
    const [updated] = await db
      .update(orders)
      .set({ status: "picked_up", pickedUpAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return NextResponse.json({ order: serialize(updated) });
  }

  if (action === "cancel") {
    if (order.status !== "accepted" && order.status !== "picked_up") {
      return NextResponse.json({ error: "Este pedido não está mais com você" }, { status: 409 });
    }
    const reason = String(body.reason ?? "").trim().slice(0, 120);
    const [back] = await db
      .update(orders)
      .set({ status: "available", courierId: null, acceptedAt: null, pickedUpAt: null, deliveryCodeAttempts: 0, renotifiedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.courierId, main.id), inArray(orders.status, ["accepted", "picked_up"])))
      .returning();
    if (!back) return NextResponse.json({ error: "Este pedido não está mais com você" }, { status: 409 });

    const rating = Math.max(RATING_MIN, Math.round((main.rating - RATING_CANCEL_PENALTY) * 100) / 100);
    const cancelCount = (main.cancelCount ?? 0) + 1;
    await db.update(couriers).set({ status: "online", rating, cancelCount }).where(eq(couriers.id, main.id));
    await db.insert(orderCancellations).values({
      orderId, courierId: main.id, storeId: order.storeId, reason, stage: order.status,
    });

    // Avisa os outros entregadores que a corrida voltou
    if (order.storeId) {
      inBackground(
        notifyCouriersNear(
          order.pickupLat,
          order.pickupLng,
          12,
          {
            title: `🔁 Corrida liberada de novo • ${order.establishment} • ${fmtBRL(order.valueNet)}`,
            body: `${order.pickupNeighborhood || "Coleta"} → ${order.deliveryNeighborhood || order.deliveryAddress} • ${fmtKm(order.distanceKm)}`,
            url: "/",
            tag: "corrida",
          },
          { respectGap: false, vehicles: order.acceptedVehicles ?? "todos" },
        ),
      );
    }
    return NextResponse.json({ ok: true, rating, cancelCount });
  }

  if (action === "deliver") {
    if (order.status !== "accepted" && order.status !== "picked_up") {
      return NextResponse.json({ error: "Pedido já encerrado" }, { status: 409 });
    }
    if (order.deliveryCode) {
      if (order.deliveryCodeAttempts >= MAX_CODE_ATTEMPTS) {
        return NextResponse.json(
          { error: "Muitas tentativas erradas. Peça para a loja confirmar a entrega pelo painel dela.", locked: true },
          { status: 423 },
        );
      }
      const given = String(body.code ?? "").replace(/\D/g, "");
      if (given !== order.deliveryCode) {
        const attempts = order.deliveryCodeAttempts + 1;
        await db.update(orders).set({ deliveryCodeAttempts: attempts }).where(eq(orders.id, orderId));
        const left = MAX_CODE_ATTEMPTS - attempts;
        return NextResponse.json(
          {
            error: left > 0
              ? `Código incorreto. Peça ao cliente o código de 4 dígitos. (${left} tentativa${left > 1 ? "s" : ""})`
              : "Código incorreto. Tentativas esgotadas: peça para a loja confirmar a entrega.",
            needsCode: true,
            attemptsLeft: left,
          },
          { status: 400 },
        );
      }
    }
    const done = await completeDelivery(order, main.id);
    return NextResponse.json({ order: serialize(done.order), earned: done.earned, tip: null });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

function serialize(o: typeof orders.$inferSelect) {
  return forCourier({
    ...o,
    ratePerKm: Math.round((o.valueNet / o.distanceKm) * 100) / 100,
    createdAt: o.createdAt.toISOString(),
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
  });
}
