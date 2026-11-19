import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionCourier, publicCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const c = await getSessionCourier(req);
  if (!c) return unauthorized();
  return NextResponse.json({ courier: publicCourier(c) });
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
  // E-mail é o login: não pode repetir o de outra conta
  if (typeof patch.email === "string") {
    const email = patch.email.trim().toLowerCase();
    const other = await db.select({ id: couriers.id }).from(couriers).where(eq(couriers.email, email)).limit(1);
    if (other[0] && other[0].id !== session.id) {
      return NextResponse.json({ error: "Este e-mail já é usado por outra conta" }, { status: 409 });
    }
    patch.email = email;
  }
  // Foto de perfil: imagem já reduzida pelo app (JPEG/WebP em data URL, até ~300 KB)
  if (patch.photoUrl !== undefined) {
    const p = String(patch.photoUrl);
    const ok = p === "" || (/^data:image\/(jpeg|webp|png);base64,/.test(p) && p.length <= 400_000);
    if (!ok) return NextResponse.json({ error: "Foto inválida ou muito grande" }, { status: 400 });
  }
  const [updated] = await db
    .update(couriers)
    .set(patch)
    .where(eq(couriers.id, session.id))
    .returning();
  return NextResponse.json({ courier: publicCourier(updated) });
}
