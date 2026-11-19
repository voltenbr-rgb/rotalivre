import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { purgeOldMessages } from "@/lib/chat";

export const dynamic = "force-dynamic";

/**
 * Manutenção automática, chamada pelo Cron Trigger da Cloudflare a cada 30 min.
 * (A simulação de corridas fictícias foi desligada: agora só há pedidos de lojas.)
 * - Rádio: apaga mensagens com +24 h e fotos com +2 h
 * Protegido por um token guardado no D1 (app_config.cron_token).
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-cron-token") ?? "";
  const row = await db.select().from(appConfig).where(eq(appConfig.key, "cron_token")).limit(1);
  if (!row[0] || token !== row[0].value) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  await purgeOldMessages();
  return NextResponse.json({ ok: true });
}
