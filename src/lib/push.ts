import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, couriers, pushSubscriptions } from "@/db/schema";
import { haversineKm } from "./domain";
import { generateVapidKeys, sendWebPush, type VapidKeys } from "./webpush";

/** Intervalo mínimo entre avisos de corrida para o mesmo aparelho (evita spam) */
const MIN_GAP_MS = 2 * 60 * 1000;
/** Posição de GPS considerada recente */
const LIVE_MS = 10 * 60 * 1000;

let cachedKeys: VapidKeys | null = null;

/** Chaves VAPID do app: geradas uma única vez e guardadas no D1 */
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;
  const rows = await db.select().from(appConfig).where(eq(appConfig.key, "vapid")).limit(1);
  if (rows[0]) {
    cachedKeys = JSON.parse(rows[0].value) as VapidKeys;
    return cachedKeys;
  }
  const fresh = await generateVapidKeys();
  await db.insert(appConfig).values({ key: "vapid", value: JSON.stringify(fresh) }).onConflictDoNothing();
  // Se duas requisições geraram ao mesmo tempo, vale a que ficou gravada
  const saved = await db.select().from(appConfig).where(eq(appConfig.key, "vapid")).limit(1);
  cachedKeys = JSON.parse(saved[0].value) as VapidKeys;
  return cachedKeys;
}

/** Roda em segundo plano depois da resposta (não atrasa o app) */
export function inBackground(task: Promise<unknown>) {
  try {
    getCloudflareContext().ctx.waitUntil(task.catch((e) => console.error("push:", e)));
  } catch {
    task.catch((e) => console.error("push:", e));
  }
}

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type SubRow = typeof pushSubscriptions.$inferSelect;

async function deliver(subs: SubRow[], msg: PushMessage, respectGap: boolean) {
  if (!subs.length) return 0;
  const keys = await getVapidKeys();
  const now = Date.now();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      if (respectGap && s.lastPushAt && now - s.lastPushAt.getTime() < MIN_GAP_MS) return;
      try {
        const status = await sendWebPush(s, { ...msg, url: msg.url ?? "/" }, keys);
        if (status === 404 || status === 410) {
          // Aparelho desinstalou ou desligou: remove o registro
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        } else if (status < 300) {
          sent++;
          await db.update(pushSubscriptions).set({ lastPushAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
        } else {
          console.error("push: serviço respondeu", status);
        }
      } catch (e) {
        console.error("push: falha no envio", e);
      }
    }),
  );
  return sent;
}

/** Avisa os entregadores com o sino ligado, online e perto do ponto (raio em km) */
export async function notifyCouriersNear(
  lat: number,
  lng: number,
  radiusKm: number,
  msg: PushMessage,
  opts: { respectGap?: boolean; vehicles?: string } = {},
) {
  const vehicles = opts.vehicles && opts.vehicles !== "todos" ? opts.vehicles.split(",") : null;
  const subs = await db.select().from(pushSubscriptions);
  if (!subs.length) return 0;
  const ids = [...new Set(subs.map((s) => s.courierId))];
  const people = await db.select().from(couriers).where(inArray(couriers.id, ids));
  const now = Date.now();
  const nearby = new Set(
    people
      .filter((c) => c.status === "online") // em pausa, offline ou em entrega não recebe
      .filter((c) => !vehicles || vehicles.includes(c.vehicleType || "moto"))
      .filter((c) => {
        const live = c.lastLat != null && c.lastLng != null && c.lastSeenAt && now - c.lastSeenAt.getTime() < LIVE_MS;
        const pos = live ? { lat: c.lastLat!, lng: c.lastLng! } : { lat: c.baseLat, lng: c.baseLng };
        return haversineKm(lat, lng, pos.lat, pos.lng) <= radiusKm;
      })
      .map((c) => c.id),
  );
  return deliver(
    subs.filter((s) => nearby.has(s.courierId)),
    msg,
    opts.respectGap ?? true,
  );
}

/** Avisa todos os aparelhos de um entregador (ex.: teste do sino) */
export async function notifyCourier(courierId: number, msg: PushMessage) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.courierId, courierId));
  return deliver(subs, msg, false);
}
