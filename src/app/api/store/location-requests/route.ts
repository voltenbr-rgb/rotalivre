import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { locationRequests } from "@/db/schema";
import { getSessionStore, unauthorized } from "@/lib/auth";
import { newPublicToken } from "@/lib/delivery";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600 * 1000;

const view = (r: typeof locationRequests.$inferSelect) => ({
  id: r.id,
  token: r.token,
  status: r.status,
  lat: r.lat,
  lng: r.lng,
  accuracy: r.accuracy,
  address: r.address,
  neighborhood: r.neighborhood,
  reference: r.reference,
  clientName: r.clientName,
  createdAt: r.createdAt.toISOString(),
  receivedAt: r.receivedAt?.toISOString() ?? null,
});

/** Links de localização da loja nas últimas 24 h */
export async function GET(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const rows = await db
    .select()
    .from(locationRequests)
    .where(and(eq(locationRequests.storeId, st.id), gte(locationRequests.createdAt, new Date(Date.now() - DAY))))
    .orderBy(desc(locationRequests.createdAt))
    .limit(30);
  return NextResponse.json({ requests: rows.map(view) });
}

/** Gera um link novo para mandar ao cliente no WhatsApp */
export async function POST(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const today = await db
    .select({ id: locationRequests.id })
    .from(locationRequests)
    .where(and(eq(locationRequests.storeId, st.id), gte(locationRequests.createdAt, new Date(Date.now() - DAY))));
  if (today.length >= 200) return NextResponse.json({ error: "Limite de links por dia atingido" }, { status: 429 });
  const [row] = await db.insert(locationRequests).values({ token: newPublicToken(), storeId: st.id }).returning();
  return NextResponse.json({ request: view(row) });
}
