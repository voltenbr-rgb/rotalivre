import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couriers, orders, transactions } from "@/db/schema";
import { grossFromNet } from "./domain";

/** Tentativas de código erradas antes de travar (aí só a loja confirma) */
export const MAX_CODE_ATTEMPTS = 5;

/** Código de entrega de 4 dígitos (0000–9999) */
export function newDeliveryCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, "0");
}

type OrderRow = typeof orders.$inferSelect;

/** Fecha a entrega: pedido entregue, ganho no extrato do entregador e status volta a Online */
export async function completeDelivery(order: OrderRow, courierId: number) {
  const [updated] = await db
    .update(orders)
    .set({ status: "delivered", deliveredAt: new Date() })
    .where(eq(orders.id, order.id))
    .returning();
  const { gross, fee } = grossFromNet(order.valueNet);
  const [tx] = await db
    .insert(transactions)
    .values({
      courierId,
      orderId: order.id,
      type: "entrega",
      description: `${order.establishment} → ${order.deliveryNeighborhood || order.deliveryAddress}`,
      amountGross: gross,
      feeAmount: fee,
      amountNet: order.valueNet,
      km: order.distanceKm,
    })
    .returning();
  const [c] = await db.select({ total: couriers.totalDeliveries, rating: couriers.rating }).from(couriers).where(eq(couriers.id, courierId)).limit(1);
  await db
    .update(couriers)
    // Cada entrega concluída recupera um pouco da nota (até 5,0)
    .set({ status: "online", totalDeliveries: (c?.total ?? 0) + 1, rating: Math.min(5, Math.round(((c?.rating ?? 5) + RATING_RECOVER) * 100) / 100) })
    .where(eq(couriers.id, courierId));
  return { order: updated, earned: tx.amountNet };
}

/** Remove do pedido o que o entregador não pode ver (o código é só da loja/cliente) */
export function forCourier<T extends { deliveryCode?: string | null; deliveryCodeAttempts?: number }>(o: T) {
  const { deliveryCode, deliveryCodeAttempts: _a, ...rest } = o;
  return { ...rest, needsCode: !!deliveryCode };
}

/** Token do link de acompanhamento do cliente (/acompanhar/<token>) */
export function newPublicToken() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Nota do entregador: desistir de corrida tira 0,2; cada entrega devolve 0,02 */
export const RATING_CANCEL_PENALTY = 0.2;
export const RATING_RECOVER = 0.02;
export const RATING_MIN = 1;
