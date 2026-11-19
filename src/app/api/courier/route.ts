import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const c = await getSessionCourier(req);
  if (!c) return unauthorized();
  return NextResponse.json({ courier: c });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const session = await getSessionCourier(req);
  if (!session) return unauthorized();
  const allowed = [
    "name", "nickname", "email", "phone", "cpf", "birthDate", "photoUrl", "status",
    "vehicleModel", "vehiclePlate", "vehicleYear", "vehicleColor",
    "cnhNumber", "cnhCategory", "cnhExpiry",
    "cep", "street", "number", "neighborhood", "city", "state",
    "workRadiusKm", "dailyGoal",
  ] as const;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const [updated] = await db
    .update(couriers)
    .set(patch)
    .where(eq(couriers.id, session.id))
    .returning();
  return NextResponse.json({ courier: updated });
}
