import { localDayStart, tzFrom, tzOffsetMs } from "@/lib/tz";
import { NextResponse } from "next/server";
import { forCourier } from "@/lib/delivery";
import { db } from "@/db";
import { transactions, orders, couriers } from "@/db/schema";
import { and, eq, gte, inArray, desc, ne } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const main = await getSessionCourier(req);
  if (!main) return unauthorized();
  const off = tzOffsetMs(tzFrom(req));
  const start = new Date(localDayStart(Date.now(), off));

  const todayTx = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.courierId, main.id), gte(transactions.createdAt, start)));

  const net = todayTx.reduce((s, t) => s + t.amountNet, 0);
  const gross = todayTx.reduce((s, t) => s + t.amountGross, 0);
  const deliveries = todayTx.filter((t) => t.type === "entrega").length;
  const km = todayTx.reduce((s, t) => s + t.km, 0);

  const firstTx = todayTx.length
    ? Math.min(...todayTx.map((t) => t.createdAt.getTime()))
    : start.getTime() + 10 * 3600000;
  const hoursOnline = Math.max(1, Math.min(12, (Date.now() - firstTx) / 3600000));
  const hourlyAverage = net / hoursOnline;

  const active = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.courierId, main.id),
        inArray(orders.status, ["accepted", "picked_up"]),
      ),
    )
    .orderBy(desc(orders.acceptedAt))
    .limit(1);

  const partners = await db
    .select()
    .from(couriers)
    .where(ne(couriers.id, main.id));
  const onlinePartners = partners.filter((p) => p.status === "online" || p.status === "em_entrega").length;

  const activeOrder = active[0]
    ? forCourier({ ...active[0], ratePerKm: active[0].valueNet / active[0].distanceKm, createdAt: active[0].createdAt.toISOString(), acceptedAt: active[0].acceptedAt?.toISOString() ?? null })
    : null;

  return NextResponse.json({
    todayNet: Math.round(net * 100) / 100,
    todayGross: Math.round(gross * 100) / 100,
    deliveriesToday: deliveries,
    kmToday: Math.round(km * 10) / 10,
    hourlyAverage: Math.round(hourlyAverage * 100) / 100,
    goal: main.dailyGoal,
    goalPercent: main.dailyGoal > 0 ? Math.min(100, Math.round((net / main.dailyGoal) * 100)) : 0,
    hoursOnline: Math.round(hoursOnline * 10) / 10,
    activeOrder,
    onlinePartners,
  });
}
