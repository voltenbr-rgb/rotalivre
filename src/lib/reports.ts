import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import type { ReportData } from "./types";
import { DEFAULT_TZ, localDayStart, localHour, localWeekday, tzOffsetMs } from "./tz";

const DAY = 86400000;

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function computeReport(courierId: number, period: number, tz: string = DEFAULT_TZ): Promise<ReportData> {
  const now = new Date();
  // "Dia" no fuso do usuário (Corumbá = America/Campo_Grande)
  const off = tzOffsetMs(tz, now);
  const startOfDay = (d: Date) => new Date(localDayStart(d.getTime(), off));
  const label = (t: number, opts: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString("pt-BR", { ...opts, timeZone: tz });
  const rangeStart = startOfDay(new Date(now.getTime() - (period - 1) * DAY));
  // Para o trimestral, buscamos 90 dias completos a partir de hoje
  const fetchStart = startOfDay(new Date(now.getTime() - 89 * DAY));

  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.courierId, courierId), gte(transactions.createdAt, fetchStart)));

  type Tx = (typeof rows)[number];
  const inRange = (t: Tx) => t.createdAt >= rangeStart;

  const sumNet = (list: Tx[]) => list.reduce((s, t) => s + t.amountNet, 0);
  const sumGross = (list: Tx[]) => list.reduce((s, t) => s + t.amountGross, 0);
  const sumFees = (list: Tx[]) => list.reduce((s, t) => s + t.feeAmount, 0);
  const sumKm = (list: Tx[]) => list.reduce((s, t) => s + t.km, 0);
  const deliveriesOf = (list: Tx[]) => list.filter((t) => t.type === "entrega").length;

  const range = rows.filter(inRange);
  const totals = {
    net: round2(sumNet(range)),
    gross: round2(sumGross(range)),
    fees: round2(sumFees(range)),
    deliveries: deliveriesOf(range),
    km: round2(sumKm(range)),
    avgTicket: 0,
    dailyAverage: 0,
    tips: round2(sumNet(range.filter((t) => t.type === "gorjeta"))),
  };
  totals.avgTicket = totals.deliveries ? round2(totals.net / totals.deliveries) : 0;

  let series: ReportData["series"] = [];
  let hourly: ReportData["hourly"] = undefined;
  let peakHour: string | null = null;
  let weekCompare: ReportData["weekCompare"] = null;
  let bestWeekdays: ReportData["bestWeekdays"] = null;
  let projection: number | null = null;
  let growthPercent: number | null = null;
  let bestDay: ReportData["bestDay"] = null;

  const dayKey = (d: Date) => startOfDay(d).getTime();
  const byDay = new Map<number, Tx[]>();
  for (const t of range) {
    const k = dayKey(t.createdAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(t);
  }

  const daysCount = period;
  totals.dailyAverage = round2(totals.net / daysCount);

  if (period === 1) {
    hourly = [];
    for (let h = 6; h <= 23; h++) {
      const list = range.filter((t) => localHour(t.createdAt.getTime(), off) === h);
      hourly.push({ hour: `${h}h`, net: round2(sumNet(list)), deliveries: deliveriesOf(list) });
    }
    series = hourly.map((x) => ({ label: x.hour, net: x.net, deliveries: x.deliveries, km: 0 }));
    const peak = [...hourly].sort((a, b) => b.deliveries - a.deliveries)[0];
    if (peak && peak.deliveries > 0) {
      const h = parseInt(peak.hour);
      peakHour = `${h}h às ${h + 1}h`;
    }
  } else if (period === 15 || period === 30) {
    for (let i = period - 1; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * DAY));
      const list = byDay.get(d.getTime()) ?? [];
      series.push({
        label: label(d.getTime(), { day: "2-digit", month: "2-digit" }),
        net: round2(sumNet(list)),
        deliveries: deliveriesOf(list),
        km: round2(sumKm(list)),
      });
    }
  } else {
    // 90 dias → 13 semanas
    for (let w = 12; w >= 0; w--) {
      const weekStart = startOfDay(new Date(now.getTime() - (w * 7 + 6) * DAY));
      const weekEnd = startOfDay(new Date(now.getTime() - w * 7 * DAY));
      const list = range.filter((t) => dayKey(t.createdAt) >= weekStart.getTime() && dayKey(t.createdAt) <= weekEnd.getTime() + DAY - 1);
      series.push({
        label: label(weekStart.getTime(), { day: "2-digit", month: "2-digit" }),
        net: round2(sumNet(list)),
        deliveries: deliveriesOf(list),
        km: round2(sumKm(list)),
      });
    }
  }

  // Melhor dia do período
  let bestNet = -1;
  for (const [k, list] of byDay) {
    const net = sumNet(list);
    if (net > bestNet) {
      bestNet = net;
      bestDay = {
        label: label(k, { weekday: "short", day: "2-digit", month: "2-digit" }),
        net: round2(net),
      };
    }
  }

  if (period === 15) {
    const firstHalf = range.filter((t) => t.createdAt < new Date(rangeStart.getTime() + 7 * DAY));
    const secondHalf = range.filter((t) => t.createdAt >= new Date(rangeStart.getTime() + 7 * DAY));
    const f = sumNet(firstHalf);
    const s = sumNet(secondHalf);
    weekCompare = {
      first: round2(f),
      second: round2(s),
      deltaPercent: f > 0 ? round2(((s - f) / f) * 100) : 0,
    };
  }

  if (period === 30) {
    const byWeekday = new Map<number, { total: number; days: Set<number> }>();
    for (const [k, list] of byDay) {
      const wd = localWeekday(k, off);
      if (!byWeekday.has(wd)) byWeekday.set(wd, { total: 0, days: new Set() });
      const e = byWeekday.get(wd)!;
      e.total += sumNet(list);
      e.days.add(k);
    }
    // conta ocorrências de cada dia da semana na janela
    const counts = new Map<number, number>();
    for (let i = 0; i < 30; i++) {
      const wd = localWeekday(now.getTime() - i * DAY, off);
      counts.set(wd, (counts.get(wd) ?? 0) + 1);
    }
    bestWeekdays = [1, 2, 3, 4, 5, 6, 0]
      .map((wd) => ({
        day: WEEKDAYS[wd],
        avg: round2((byWeekday.get(wd)?.total ?? 0) / (counts.get(wd) ?? 1)),
      }))
      .sort((a, b) => b.avg - a.avg);
    projection = round2(totals.dailyAverage * 30);
  }

  if (period === 90) {
    const first30 = rows.filter((t) => t.createdAt < new Date(fetchStart.getTime() + 30 * DAY));
    const last30 = rows.filter((t) => t.createdAt >= new Date(now.getTime() - 30 * DAY));
    const f = sumNet(first30);
    const l = sumNet(last30);
    growthPercent = f > 0 ? round2(((l - f) / f) * 100) : 0;
  }

  return {
    period,
    totals,
    series,
    hourly,
    peakHour,
    weekCompare,
    bestWeekdays,
    projection,
    growthPercent,
    bestDay: bestNet > 0 ? bestDay : null,
  };
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}
