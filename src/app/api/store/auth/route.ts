import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession, deleteSession, getSessionStore, publicStore, unauthorized } from "@/lib/auth";
import { clearFails, failMessage, lockedMessage, lockStatus, registerFail } from "@/lib/loginGuard";
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

  if (action === "change_password") {
    const st = await getSessionStore(req);
    if (!st) return unauthorized();
    if (!(await verifyPassword(String(body.current ?? ""), st.passwordHash))) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }
    const err = validatePassword(String(body.next ?? ""));
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await db.update(stores).set({ passwordHash: await hashPassword(String(body.next)) }).where(eq(stores.id, st.id));
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }

  if (action === "register") {
    if (body.acceptTerms !== true) {
      return NextResponse.json({ error: "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade" }, { status: 400 });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    const existing = await db.select({ id: stores.id }).from(stores).where(sql`lower(${stores.email}) = ${email}`).limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "Este e-mail já tem uma loja cadastrada. Use Entrar." }, { status: 409 });
    }
    const [created] = await db
      .insert(stores)
      .values({ email, passwordHash: await hashPassword(password), name: String(body.name ?? "").trim(), termsAcceptedAt: new Date() })
      .returning();
    const token = await createSession(created.id, "store");
    return NextResponse.json({ store: publicStore(created), token });
  }

  if (action === "login") {
    const guardKey = `store:${email}`;
    const lock = await lockStatus(guardKey);
    if (lock.locked) return NextResponse.json({ error: lockedMessage(lock.minutes), locked: true }, { status: 429 });
    const rows = await db.select().from(stores).where(sql`lower(${stores.email}) = ${email}`).limit(1);
    const st = rows[0];
    if (!st || !(await verifyPassword(password, st.passwordHash))) {
      const f = await registerFail(guardKey);
      return NextResponse.json({ error: failMessage(f.left), locked: f.locked }, { status: f.locked ? 429 : 401 });
    }
    if (st.blocked) {
      return NextResponse.json({ error: "Loja bloqueada. Fale com o suporte do RotaLivre." }, { status: 403 });
    }
    await clearFails(guardKey);
    const token = await createSession(st.id, "store");
    return NextResponse.json({ store: publicStore(st), token });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
