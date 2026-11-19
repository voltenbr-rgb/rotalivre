import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSessionStore, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Loja cancela um pedido que ainda ninguém aceitou */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const { id } = await params;
  const [updated] = await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, parseInt(id)), eq(orders.storeId, st.id), eq(orders.status, "available")))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Só dá para cancelar pedido que ainda não foi aceito" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
