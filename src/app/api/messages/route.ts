import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, couriers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureSeeded, getSessionCourier } from "@/lib/seed";
import { AMBIENT_TEXTS } from "@/lib/domain";

export const dynamic = "force-dynamic";

const AMBIENT_ALERTS = [
  { alertType: "alagamento", content: "Rua alagada perto da estação, água na canela. Evitem a parte baixa!", neighborhood: "Socorro" },
  { alertType: "risco", content: "Movimentação estranha na viela atrás do mercado, passem pela avenida principal", neighborhood: "Jardim Ângela" },
  { alertType: "blitz", content: "Comando de trânsito na entrada do Morumbi, cavaletes na pista", neighborhood: "Morumbi" },
  { alertType: "restaurante", content: "Sushi Yama tá com fila de motoboy, 20 min de espera fácil", neighborhood: "Santo Amaro" },
];

/** Movimento orgânico da comunidade: parceiros publicam no canal de tempos em tempos */
async function ambientActivity(channel: string) {
  if (Math.random() > 0.22) return;
  const partners = await db
    .select()
    .from(couriers)
    .where(eq(couriers.isMain, false));
  const online = partners.filter((p) => p.status !== "pausa");
  if (!online.length) return;
  const sender = online[Math.floor(Math.random() * online.length)];
  if (Math.random() < 0.3) {
    const a = AMBIENT_ALERTS[Math.floor(Math.random() * AMBIENT_ALERTS.length)];
    await db.insert(messages).values({
      courierId: sender.id,
      channel,
      kind: "alerta",
      alertType: a.alertType,
      content: a.content,
      neighborhood: a.neighborhood,
      lat: sender.baseLat,
      lng: sender.baseLng,
    });
  } else {
    await db.insert(messages).values({
      courierId: sender.id,
      channel,
      kind: "texto",
      content: AMBIENT_TEXTS[Math.floor(Math.random() * AMBIENT_TEXTS.length)],
      neighborhood: sender.neighborhood || "Campo Limpo",
    });
  }
}

export async function GET(req: Request) {
  await ensureSeeded();
  const main = await getSessionCourier(req);
  const channel = new URL(req.url).searchParams.get("channel") ?? "Zona Sul";
  await ambientActivity(channel);

  const rows = await db
    .select({
      id: messages.id,
      courierId: messages.courierId,
      channel: messages.channel,
      kind: messages.kind,
      alertType: messages.alertType,
      content: messages.content,
      audioDurationSec: messages.audioDurationSec,
      neighborhood: messages.neighborhood,
      createdAt: messages.createdAt,
      senderName: couriers.name,
      senderNickname: couriers.nickname,
    })
    .from(messages)
    .leftJoin(couriers, eq(messages.courierId, couriers.id))
    .where(eq(messages.channel, channel))
    .orderBy(desc(messages.createdAt))
    .limit(60);

  const result = rows.reverse().map((m) => ({
    ...m,
    isMe: m.courierId === main.id,
    alertType: m.alertType as never,
    createdAt: m.createdAt.toISOString(),
  }));
  return NextResponse.json({ messages: result });
}

export async function POST(req: Request) {
  const main = await getSessionCourier(req);
  const body = await req.json();
  const [created] = await db
    .insert(messages)
    .values({
      courierId: main.id,
      channel: body.channel ?? "Zona Sul",
      kind: body.kind ?? "texto",
      alertType: body.alertType ?? null,
      content: body.content ?? "",
      audioDurationSec: body.audioDurationSec ?? null,
      neighborhood: body.neighborhood ?? main.neighborhood,
      lat: body.lat ?? main.baseLat,
      lng: body.lng ?? main.baseLng,
    })
    .returning();

  return NextResponse.json({
    message: {
      ...created,
      senderName: main.name,
      senderNickname: main.nickname,
      isMe: true,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
