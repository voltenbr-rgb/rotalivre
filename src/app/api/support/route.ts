import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { supportRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * "Esqueci minha senha" e outros pedidos de suporte (sem login).
 * Ficam no painel master, que gera uma senha provisória e chama a pessoa.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const accountType = b.accountType === "store" ? "store" : "courier";
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe o e-mail da conta" }, { status: 400 });
  }
  const contact = String(b.contact ?? "").trim().slice(0, 40);
  if (contact.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Informe um WhatsApp com DDD para o suporte te chamar" }, { status: 400 });
  }
  // Evita repetição: no máximo 3 pedidos por e-mail em 24 h
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await db
    .select({ id: supportRequests.id })
    .from(supportRequests)
    .where(and(eq(supportRequests.email, email), gte(supportRequests.createdAt, dayAgo)));
  if (recent.length >= 3) {
    return NextResponse.json({ ok: true, note: "Já recebemos seu pedido. O suporte vai te chamar." });
  }
  await db.insert(supportRequests).values({
    accountType,
    email,
    contact,
    message: String(b.message ?? "").trim().slice(0, 300),
    kind: b.kind === "outro" ? "outro" : "senha",
  });
  return NextResponse.json({ ok: true });
}
