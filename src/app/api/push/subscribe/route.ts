import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Liga o sino: guarda (ou atualiza) a inscrição deste aparelho */
export async function POST(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint ?? "");
  const p256dh = String(body.keys?.p256dh ?? "");
  const auth = String(body.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }
  await db
    .insert(pushSubscriptions)
    .values({ courierId: me.id, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { courierId: me.id, p256dh, auth } });
  return NextResponse.json({ ok: true });
}

/** Desliga o sino neste aparelho */
export async function DELETE(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body.endpoint ?? "");
  if (endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return NextResponse.json({ ok: true });
}
