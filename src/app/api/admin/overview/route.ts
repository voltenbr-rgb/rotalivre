import { NextResponse } from "next/server";
import { desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { couriers, orders, stores, supportRequests } from "@/db/schema";
import { isAdmin, unauthorized } from "@/lib/auth";
import { localDayStart, tzFrom, tzOffsetMs } from "@/lib/tz";

export const dynamic = "force-dynamic";

/** Visão geral do ecossistema: lojas, entregadores e pedidos reais */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  // "Hoje" no fuso de quem abre o painel
  const dayAgo = new Date(localDayStart(Date.now(), tzOffsetMs(tzFrom(req))));
  const tenMin = Date.now() - 10 * 60 * 1000;

  const [storeRows, courierRows, recent, today, support] = await Promise.all([
    db.select().from(stores).orderBy(desc(stores.createdAt)).limit(200),
    db.select().from(couriers).orderBy(desc(couriers.createdAt)).limit(300),
    db
      .select({ o: orders, storeName: stores.name, courierNick: couriers.nickname })
      .from(orders)
      .leftJoin(stores, eq(stores.id, orders.storeId))
      .leftJoin(couriers, eq(couriers.id, orders.courierId))
      .where(isNotNull(orders.storeId))
      .orderBy(desc(orders.createdAt))
      .limit(30),
    db
      .select({
        total: sql<number>`count(*)`,
        delivered: sql<number>`sum(case when ${orders.status} = 'delivered' then 1 else 0 end)`,
        value: sql<number>`coalesce(sum(case when ${orders.status} = 'delivered' then ${orders.valueNet} else 0 end), 0)`,
      })
      .from(orders)
      .where(sql`${orders.storeId} is not null and ${orders.createdAt} >= ${dayAgo.getTime()}`),
    db.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(50),
  ]);

  return NextResponse.json({
    stats: {
      stores: storeRows.length,
      couriers: courierRows.length,
      couriersOnline: courierRows.filter((c) => c.status !== "offline" && c.lastSeenAt && c.lastSeenAt.getTime() > tenMin).length,
      ordersToday: Number(today[0]?.total ?? 0),
      deliveredToday: Number(today[0]?.delivered ?? 0),
      valueToday: Number(today[0]?.value ?? 0),
      supportOpen: support.filter((r) => r.status === "aberto").length,
    },
    support: support.map((r) => ({
      id: r.id,
      accountType: r.accountType,
      email: r.email,
      contact: r.contact,
      message: r.message,
      kind: r.kind,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    stores: storeRows.map((s) => ({
      id: s.id,
      name: s.name || "(sem nome)",
      email: s.email,
      category: s.category,
      city: s.city,
      located: s.lat != null,
      blocked: s.blocked,
      createdAt: s.createdAt.toISOString(),
    })),
    couriers: courierRows.map((c) => ({
      id: c.id,
      name: c.name,
      nickname: c.nickname,
      email: c.email,
      vehicleType: c.vehicleType,
      status: c.status,
      blocked: c.blocked,
      city: c.city,
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    orders: recent.map(({ o, storeName, courierNick }) => ({
      id: o.id,
      code: o.code,
      store: storeName ?? "?",
      courier: courierNick ?? null,
      status: o.status,
      valueNet: o.valueNet,
      distanceKm: o.distanceKm,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
