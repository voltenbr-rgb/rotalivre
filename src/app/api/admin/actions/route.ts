import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { couriers, stores, supportRequests } from "@/db/schema";
import { deleteAccountSessions, isAdmin, unauthorized } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { clearFails } from "@/lib/loginGuard";

export const dynamic = "force-dynamic";

/** Senha provisória fácil de ditar: 6 dígitos */
function tempPassword() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/**
 * Ações do painel master:
 * - reset_password { type, email, requestId? } → gera senha provisória
 * - block / unblock { type, id }
 * - resolve { requestId }
 */
export async function POST(req: Request) {
  if (!(await isAdmin(req))) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  const type = b.type === "store" ? "store" : "courier";
  const table = type === "store" ? stores : couriers;

  if (action === "reset_password") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const rows = await db.select({ id: table.id }).from(table).where(sql`lower(${table.email}) = ${email}`).limit(1);
    if (!rows[0]) return NextResponse.json({ error: "Nenhuma conta com esse e-mail" }, { status: 404 });
    const temp = tempPassword();
    await db.update(table).set({ passwordHash: await hashPassword(temp) }).where(eq(table.id, rows[0].id));
    await deleteAccountSessions(type, rows[0].id); // desconecta os aparelhos
    await clearFails(`${type}:${email}`);
    if (b.requestId) {
      await db
        .update(supportRequests)
        .set({ status: "resolvido", resolvedAt: new Date() })
        .where(eq(supportRequests.id, Number(b.requestId)));
    }
    return NextResponse.json({ ok: true, tempPassword: temp });
  }

  if (action === "block" || action === "unblock") {
    const id = Number(b.id);
    await db.update(table).set({ blocked: action === "block" }).where(eq(table.id, id));
    if (action === "block") await deleteAccountSessions(type, id);
    return NextResponse.json({ ok: true });
  }

  if (action === "resolve") {
    await db
      .update(supportRequests)
      .set({ status: "resolvido", resolvedAt: new Date() })
      .where(eq(supportRequests.id, Number(b.requestId)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
