import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";

/** O rádio guarda só as últimas 24 horas */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Apaga mensagens (e áudios) com mais de 24 h */
export async function purgeOldMessages() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  await db.run(
    sql`DELETE FROM message_audio WHERE message_id IN (SELECT id FROM messages WHERE created_at < ${cutoff.getTime()})`,
  );
  await db.delete(messages).where(lt(messages.createdAt, cutoff));
}
