import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, orders } from "@/db/schema";
import { CORUMBA_CENTER, generateOrder } from "@/lib/domain";
import { fmtBRL, fmtKm } from "@/lib/format";
import { notifyCouriersNear } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * SIMULAÇÃO (teste de notificação): chamado pelo Cron Trigger da Cloudflare
 * a cada 30 min. Cria um pedido de teste em Corumbá/Ladário e avisa quem
 * está com o sino ligado e Online na região.
 * Protegido por um token guardado no D1 (app_config.cron_token).
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-cron-token") ?? "";
  const row = await db.select().from(appConfig).where(eq(appConfig.key, "cron_token")).limit(1);
  if (!row[0] || token !== row[0].value) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const [order] = await db.insert(orders).values(generateOrder(CORUMBA_CENTER)).returning();
  const sent = await notifyCouriersNear(order.pickupLat, order.pickupLng, 30, {
    title: `🛵 ${order.establishment} pede entregador`,
    body: `${order.pickupNeighborhood} → ${order.deliveryNeighborhood} • ${fmtBRL(order.valueNet)} • ${fmtKm(order.distanceKm)}`,
    url: "/",
    tag: "corrida",
  });

  return NextResponse.json({ ok: true, order: order.code, notified: sent });
}
