import { NextResponse } from "next/server";
import { adminPassword, createSession, deleteSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Entrada do painel master (senha master). Logout com { action: "logout" }. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "logout") {
    await deleteSession(req);
    return NextResponse.json({ ok: true });
  }
  const given = String(body.password ?? "");
  const expected = adminPassword();
  // Comparação em tempo constante
  let diff = given.length ^ expected.length;
  for (let i = 0; i < Math.max(given.length, expected.length); i++) {
    diff |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  if (diff !== 0) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativas
    return NextResponse.json({ error: "Senha master incorreta" }, { status: 401 });
  }
  const token = await createSession(0, "admin");
  return NextResponse.json({ token });
}
