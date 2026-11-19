import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messageAudio, messagePhoto, messages } from "@/db/schema";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Apaga uma mensagem do rádio para todos. Só quem enviou pode apagar. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const { id: raw } = await params;
  const id = parseInt(raw);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.courierId, me.id)))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ error: "Você só pode apagar as suas mensagens" }, { status: 403 });
  }

  await db.batch([
    db.delete(messageAudio).where(eq(messageAudio.messageId, id)),
    db.delete(messagePhoto).where(eq(messagePhoto.messageId, id)),
    db.delete(messages).where(eq(messages.id, id)),
  ]);
  return NextResponse.json({ ok: true });
}
