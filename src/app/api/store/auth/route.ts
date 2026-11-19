import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { createSession, deleteSession, publicStore } from "@/lib/auth";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/**
 * Conta da LOJA (separada dos entregadores):
 * - "register": e-mail + senha (+ nome opcional)
 * - "login": e-mail + senha
 * - "logout": invalida a chave deste aparelho
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "logout") {
    await deleteSession(req);
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }

  if (action === "register") {
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    const existing = await db.select({ id: stores.id }).from(stores).where(sql`lower(${stores.email}) = ${email}`).limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "Este e-mail já tem uma loja cadastrada. Use Entrar." }, { status: 409 });
    }
    const [created] = await db
      .insert(stores)
      .values({ email, passwordHash: await hashPassword(password), name: String(body.name ?? "").trim() })
      .returning();
    const token = await createSession(created.id, "store");
    return NextResponse.json({ store: publicStore(created), token });
  }

  if (action === "login") {
    const rows = await db.select().from(stores).where(sql`lower(${stores.email}) = ${email}`).limit(1);
    const st = rows[0];
    if (!st || !(await verifyPassword(password, st.passwordHash))) {
      return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
    }
    const token = await createSession(st.id, "store");
    return NextResponse.json({ store: publicStore(st), token });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
