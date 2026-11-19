import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { getSessionStore, publicStore, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  return NextResponse.json({ store: publicStore(st) });
}

/** Atualiza os dados da loja (nome, tipo, telefone, endereço e o ponto no mapa) */
export async function PUT(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof stores.$inferInsert> = { updatedAt: new Date() };
  for (const k of ["name", "category", "phone", "address", "neighborhood", "city"] as const) {
    if (typeof body[k] === "string") patch[k] = body[k].trim().slice(0, 160);
  }
  if (typeof body.lat === "number" && typeof body.lng === "number" && Math.abs(body.lat) <= 90 && Math.abs(body.lng) <= 180) {
    patch.lat = body.lat;
    patch.lng = body.lng;
  }
  const [updated] = await db.update(stores).set(patch).where(eq(stores.id, st.id)).returning();
  return NextResponse.json({ store: publicStore(updated) });
}
