import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Entregador da sessão: lê o header `x-courier-id` (ou `?cid=`) enviado pelo app.
 * Sem sessão válida devolve null; a rota responde 401 e o app volta ao login.
 */
export async function getSessionCourier(req: Request) {
  const url = new URL(req.url);
  const raw = req.headers.get("x-courier-id") ?? url.searchParams.get("cid");
  const id = raw ? parseInt(raw) : NaN;
  if (Number.isNaN(id)) return null;
  const rows = await db.select().from(couriers).where(eq(couriers.id, id)).limit(1);
  return rows[0] ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
