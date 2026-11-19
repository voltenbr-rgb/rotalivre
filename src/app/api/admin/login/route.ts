import { NextResponse } from "next/server";
import { adminPassword, createSession, deleteSession } from "@/lib/auth";
import { clearFails, lockedMessage, lockStatus, registerFail } from "@/lib/loginGuard";

export const dynamic = "force-dynamic";

/** Entrada do painel master (senha master). Logout com { action: "logout" }. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "logout") {
    await deleteSession(req);
    return NextResponse.json({ ok: true });
  }
  const lock = await lockStatus("admin:master");
  if (lock.locked) return NextResponse.json({ error: lockedMessage(lock.minutes) }, { status: 429 });
  const given = String(body.password ?? "");
  const expected = adminPassword();
  // Comparação em tempo constante
  let diff = given.length ^ expected.length;
  for (let i = 0; i < Math.max(given.length, expected.length); i++) {
    diff |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  if (diff !== 0) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativas
    const f = await registerFail("admin:master");
    return NextResponse.json({ error: f.locked ? lockedMessage(10) : "Senha master incorreta" }, { status: f.locked ? 429 : 401 });
  }
  await clearFails("admin:master");
  const token = await createSession(0, "admin");
  return NextResponse.json({ token });
}
