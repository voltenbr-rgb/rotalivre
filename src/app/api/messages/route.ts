import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { couriers, messageAudio, messagePhoto, messages } from "@/db/schema";
import { getSessionCourier, unauthorized } from "@/lib/auth";
import { haversineKm } from "@/lib/domain";
import { PHOTO_RETENTION_MS, purgeOldMessages, RETENTION_MS } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** "Perto de mim": mensagens enviadas a até 15 km da minha posição */
const NEAR_KM = 15;
/** Posição de GPS considerada atual */
const LIVE_MS = 10 * 60 * 1000;
/** Foto: já reduzida no celular (até 1600 px JPEG, ~250-450 KB) */
const MAX_PHOTO_B64 = 1_100_000;
/** Áudio: até ~60 s de voz comprimida */
const MAX_AUDIO_B64 = 900_000;

type Me = NonNullable<Awaited<ReturnType<typeof getSessionCourier>>>;

function positionOf(c: Me) {
  const live = c.lastLat != null && c.lastLng != null && c.lastSeenAt && Date.now() - c.lastSeenAt.getTime() < LIVE_MS;
  return live ? { lat: c.lastLat!, lng: c.lastLng! } : { lat: c.baseLat, lng: c.baseLng };
}

/** Nome da cidade do cadastro (canal "Minha cidade") */
function cityOf(c: Me) {
  return (c.city || "").trim() || "Sem cidade";
}

export async function GET(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const scope = new URL(req.url).searchParams.get("scope") === "cidade" ? "cidade" : "perto";
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const myPos = positionOf(me);

  const base = db
    .select({
      id: messages.id,
      courierId: messages.courierId,
      channel: messages.channel,
      kind: messages.kind,
      alertType: messages.alertType,
      content: messages.content,
      audioDurationSec: messages.audioDurationSec,
      neighborhood: messages.neighborhood,
      lat: messages.lat,
      lng: messages.lng,
      createdAt: messages.createdAt,
      senderName: couriers.name,
      senderNickname: couriers.nickname,
      senderPhoto: couriers.photoUrl,
      hasAudio: sql<number>`EXISTS (SELECT 1 FROM message_audio a WHERE a.message_id = ${messages.id})`,
      hasPhoto: sql<number>`EXISTS (SELECT 1 FROM message_photo p WHERE p.message_id = ${messages.id} AND p.created_at >= ${Date.now() - PHOTO_RETENTION_MS})`,
    })
    .from(messages)
    .leftJoin(couriers, eq(messages.courierId, couriers.id));

  let rows;
  if (scope === "cidade") {
    rows = await base
      .where(and(gte(messages.createdAt, cutoff), sql`lower(${messages.channel}) = lower(${cityOf(me)})`))
      .orderBy(desc(messages.createdAt))
      .limit(80);
  } else {
    const recent = await base
      .where(and(gte(messages.createdAt, cutoff), isNotNull(messages.lat), isNotNull(messages.lng)))
      .orderBy(desc(messages.createdAt))
      .limit(400);
    rows = recent
      .filter((m) => m.courierId === me.id || haversineKm(myPos.lat, myPos.lng, m.lat!, m.lng!) <= NEAR_KM)
      .slice(0, 80);
  }

  const result = rows.reverse().map((m) => {
    const isMe = m.courierId === me.id;
    const distanceKm =
      !isMe && m.lat != null && m.lng != null ? Math.round(haversineKm(myPos.lat, myPos.lng, m.lat, m.lng) * 10) / 10 : null;
    return {
      id: m.id,
      courierId: m.courierId,
      channel: m.channel,
      kind: m.kind,
      alertType: m.alertType as never,
      content: m.content,
      audioDurationSec: m.audioDurationSec,
      neighborhood: m.neighborhood,
      senderName: m.senderName ?? "Associado",
      senderNickname: m.senderNickname ?? "",
      senderPhoto: m.senderPhoto || null,
      audioUrl: m.hasAudio ? `/api/messages/audio/${m.id}` : null,
      photoUrl: m.hasPhoto ? `/api/messages/photo/${m.id}` : null,
      distanceKm,
      isMe,
      createdAt: m.createdAt.toISOString(),
    };
  });
  return NextResponse.json({ messages: result, scope, city: cityOf(me), nearKm: NEAR_KM });
}

export async function POST(req: Request) {
  const me = await getSessionCourier(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const kind = ["texto", "audio", "alerta", "foto"].includes(body.kind) ? body.kind : "texto";
  const content = String(body.content ?? "").slice(0, 1000);
  if (kind === "texto" && !content.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  // Áudio: base64 + tipo (webm/opus no Android, mp4/aac no iPhone)
  let audio: { mime: string; dataB64: string } | null = null;
  if (kind === "audio" && typeof body.audioB64 === "string" && body.audioB64.length > 0) {
    const mime = String(body.audioMime ?? "audio/webm");
    if (!/^audio\/[a-z0-9.+-]+(;.*)?$/i.test(mime) || body.audioB64.length > MAX_AUDIO_B64) {
      return NextResponse.json({ error: "Áudio inválido ou longo demais" }, { status: 400 });
    }
    audio = { mime, dataB64: body.audioB64 };
  }

  // Foto: JPEG/WebP em base64, já reduzida pelo app
  let photo: { mime: string; dataB64: string } | null = null;
  if (kind === "foto") {
    const mime = String(body.photoMime ?? "image/jpeg");
    const data = typeof body.photoB64 === "string" ? body.photoB64 : "";
    if (!/^image\/(jpeg|webp|png)$/.test(mime) || !data || data.length > MAX_PHOTO_B64) {
      return NextResponse.json({ error: "Foto inválida ou grande demais" }, { status: 400 });
    }
    photo = { mime, dataB64: data };
  }

  const pos = positionOf(me);
  const [created] = await db
    .insert(messages)
    .values({
      courierId: me.id,
      channel: cityOf(me), // canal "Minha cidade" = cidade do cadastro
      kind,
      alertType: kind === "alerta" ? String(body.alertType ?? "risco") : null,
      content,
      audioDurationSec: kind === "audio" ? Math.min(60, Math.max(1, Number(body.audioDurationSec) || 1)) : null,
      neighborhood: String(body.neighborhood ?? me.neighborhood ?? ""),
      lat: pos.lat,
      lng: pos.lng,
    })
    .returning();

  if (audio) {
    await db.insert(messageAudio).values({ messageId: created.id, mime: audio.mime, dataB64: audio.dataB64 });
  }
  if (photo) {
    await db.insert(messagePhoto).values({ messageId: created.id, mime: photo.mime, dataB64: photo.dataB64 });
  }

  // Limpeza oportunista (o Cron também limpa a cada 30 min)
  if (Math.random() < 0.1) await purgeOldMessages().catch(() => null);

  return NextResponse.json({
    message: {
      id: created.id,
      courierId: me.id,
      channel: created.channel,
      kind: created.kind,
      alertType: created.alertType,
      content: created.content,
      audioDurationSec: created.audioDurationSec,
      neighborhood: created.neighborhood,
      senderName: me.name,
      senderNickname: me.nickname,
      senderPhoto: me.photoUrl || null,
      audioUrl: audio ? `/api/messages/audio/${created.id}` : null,
      photoUrl: photo ? `/api/messages/photo/${created.id}` : null,
      distanceKm: null,
      isMe: true,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
