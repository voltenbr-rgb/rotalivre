import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messageAudio } from "@/db/schema";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Entrega o áudio de uma mensagem do rádio (só para associados logados) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const rows = await db
    .select()
    .from(messageAudio)
    .where(eq(messageAudio.messageId, parseInt(id)))
    .limit(1);
  if (!rows[0]) return new Response("Áudio não encontrado (o rádio guarda só 24 h)", { status: 404 });
  const bin = atob(rows[0].dataB64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "Content-Type": rows[0].mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
