import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, couriers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionCourier, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const main = await getSessionCourier(req);
  if (!main) return unauthorized();
  const channel = new URL(req.url).searchParams.get("channel") ?? "Zona Sul";

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
  if (!main) return unauthorized();
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
