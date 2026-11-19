import { NextResponse } from "next/server";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { inBackground, notifyCourier } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Envia uma notificação de teste para o próprio entregador depois de 10 s (dá tempo de fechar o app) */
export async function POST(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  inBackground(
    new Promise((r) => setTimeout(r, 10_000)).then(() =>
      notifyCourier(me.id, {
        title: "🛵 Teste do RotaLivre",
        body: "Notificações funcionando! Assim chegam as corridas novas.",
        url: "/",
        tag: "teste",
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
