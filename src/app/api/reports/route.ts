import { NextResponse } from "next/server";
import { getSessionCourier } from "@/lib/seed";
import { computeReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const main = await getSessionCourier(req);
  const period = parseInt(new URL(req.url).searchParams.get("period") ?? "1");
  const valid = [1, 15, 30, 90].includes(period) ? period : 1;
  const report = await computeReport(main.id, valid);
  return NextResponse.json({ report });
}
