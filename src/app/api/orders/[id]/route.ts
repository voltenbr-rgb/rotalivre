import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, transactions, couriers } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getSessionCourier } from "@/lib/seed";
import { grossFromNet } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const orderId = parseInt(id);
  const { action } = await req.json();
  const main = await getSessionCourier(req);

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  if (action === "accept") {
    if (order.status !== "available") {
      return NextResponse.json({ error: "Pedido já foi aceito por outro entregador" }, { status: 409 });
    }
    const active = await db
      .select()
      .from(orders)
      .where(and(eq(orders.courierId, main.id), inArray(orders.status, ["accepted", "picked_up"])));
    if (active.length > 0) {
      return NextResponse.json({ error: "Você já tem uma entrega em andamento" }, { status: 409 });
    }
    const [updated] = await db
      .update(orders)
      .set({ status: "accepted", courierId: main.id, acceptedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    await db.update(couriers).set({ status: "em_entrega" }).where(eq(couriers.id, main.id));
    return NextResponse.json({ order: serialize(updated) });
  }

  if (action === "pickup") {
    const [updated] = await db
      .update(orders)
      .set({ status: "picked_up", pickedUpAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return NextResponse.json({ order: serialize(updated) });
  }

  if (action === "deliver") {
    const [updated] = await db
      .update(orders)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    const { gross, fee } = grossFromNet(order.valueNet);
    const [tx] = await db
      .insert(transactions)
      .values({
        courierId: main.id,
        orderId: order.id,
        type: "entrega",
        description: `${order.establishment} → ${order.deliveryNeighborhood}`,
        amountGross: gross,
        feeAmount: fee,
        amountNet: order.valueNet,
        km: order.distanceKm,
      })
      .returning();

    let tip: number | null = null;
    if (Math.random() < 0.35) {
      tip = Math.round((2 + Math.random() * 7) * 2) / 2;
      await db.insert(transactions).values({
        courierId: main.id,
        orderId: order.id,
        type: "gorjeta",
        description: `Gorjeta • ${order.clientName}`,
        amountGross: tip,
        feeAmount: 0,
        amountNet: tip,
        km: 0,
      });
    }

    await db
      .update(couriers)
      .set({ status: "online", totalDeliveries: main.totalDeliveries + 1 })
      .where(eq(couriers.id, main.id));

    return NextResponse.json({ order: serialize(updated), earned: tx.amountNet, tip });
  }

  if (action === "dismiss") {
    // Recusar é livre: nenhuma punição, apenas some do seu feed
    await db.update(orders).set({ status: "dismissed" }).where(eq(orders.id, orderId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

function serialize(o: typeof orders.$inferSelect) {
  return {
    ...o,
    ratePerKm: Math.round((o.valueNet / o.distanceKm) * 100) / 100,
    createdAt: o.createdAt.toISOString(),
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    pickedUpAt: o.pickedUpAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
  };
}
