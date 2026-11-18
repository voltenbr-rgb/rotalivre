import { db, insertMany } from "@/db";
import { couriers, orders, transactions, messages } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import {
  generateOrder,
  grossFromNet,
  PARTNERS_SEED,
  MAIN_BASE,
  rnd,
  pick,
} from "./domain";

// No Worker o módulo vive entre requisições: guardamos só o "já semeado",
// nunca uma Promise (ela ficaria presa ao contexto de outra requisição).
let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  await runSeed();
  seeded = true;
}

async function runSeed() {
  const existing = await db.select({ c: count() }).from(couriers);
  if (existing[0].c > 0) return;

  /* Courier principal — Rafael "Fumaça" Santos */
  const [main] = await db
    .insert(couriers)
    .values({
      isMain: true,
      name: "Rafael Santos",
      nickname: "Fumaça",
      email: "rafael.fumaca@email.com",
      phone: "(11) 98765-4321",
      cpf: "384.512.908-77",
      birthDate: "1992-04-18",
      photoUrl:
        "https://images.pexels.com/photos/9607206/pexels-photo-9607206.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=160&w=160",
      status: "online",
      vehicleModel: "Honda CG 160 Titan",
      vehiclePlate: "FRL7A42",
      vehicleYear: "2022",
      vehicleColor: "Vermelha",
      cnhNumber: "04829173655",
      cnhCategory: "AB",
      cnhExpiry: "2028-09-30",
      cep: "05777-120",
      street: "Rua Professor Leitão da Cunha",
      number: "412",
      neighborhood: "Campo Limpo",
      city: "São Paulo",
      state: "SP",
      workRadiusKm: 8,
      dailyGoal: 250,
      baseLat: MAIN_BASE.lat,
      baseLng: MAIN_BASE.lng,
      rating: 4.9,
      totalDeliveries: 1284,
    })
    .returning();

  /* Parceiros da rede */
  const partnerRows = await insertMany(
    couriers,
    PARTNERS_SEED.map((p) => ({
        isMain: false,
        name: p.name,
        nickname: p.nickname,
        status: p.status,
        baseLat: p.lat,
        baseLng: p.lng,
        neighborhood: "Campo Limpo",
        city: "São Paulo",
        state: "SP",
        vehicleModel: pick(["Honda CG 160", "Yamaha Factor 150", "Honda Biz 125", "Yamaha Fazer 250"]),
        rating: Math.round(rnd(4.6, 5.0) * 10) / 10,
      })),
  );

  /* Histórico financeiro — últimos 90 dias (base dos relatórios) */
  const now = new Date();
  const txRows: (typeof transactions.$inferInsert)[] = [];
  const hourWeights = [
    { h: 11, w: 12 }, { h: 12, w: 16 }, { h: 13, w: 10 }, { h: 14, w: 5 },
    { h: 15, w: 4 }, { h: 16, w: 5 }, { h: 17, w: 7 }, { h: 18, w: 11 },
    { h: 19, w: 15 }, { h: 20, w: 14 }, { h: 21, w: 9 }, { h: 22, w: 4 },
  ];
  const pickHour = () => {
    const total = hourWeights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of hourWeights) { r -= x.w; if (r <= 0) return x.h; }
    return 19;
  };

  for (let dayBack = 90; dayBack >= 1; dayBack--) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayBack);
    const dow = d.getDay();
    // folga em alguns domingos
    if (dow === 0 && Math.random() < 0.55) continue;
    const growth = 1 + (90 - dayBack) * 0.0022; // evolução gradual de ganhos
    const weekendBoost = dow === 5 || dow === 6 ? 1.35 : dow === 4 ? 1.15 : 1;
    const n = Math.round(rnd(8, 15) * weekendBoost * growth);
    for (let i = 0; i < n; i++) {
      const km = Math.round(rnd(1.4, 9.5) * 10) / 10;
      const net = Math.round((5.5 + km * 2.3 + rnd(0, 2.5)) * 2) / 2;
      const { gross, fee } = grossFromNet(net);
      const ts = new Date(d);
      ts.setHours(pickHour(), Math.floor(rnd(0, 59)), Math.floor(rnd(0, 59)));
      txRows.push({
        courierId: main.id,
        type: "entrega",
        description: `Entrega • ${km.toFixed(1)} km`,
        amountGross: gross,
        feeAmount: fee,
        amountNet: net,
        km,
        createdAt: ts,
      });
      if (Math.random() < 0.22) {
        const tip = Math.round(rnd(2, 9) * 2) / 2;
        txRows.push({
          courierId: main.id,
          type: "gorjeta",
          description: "Gorjeta do cliente",
          amountGross: tip,
          feeAmount: 0,
          amountNet: tip,
          km: 0,
          createdAt: ts,
        });
      }
    }
  }

  /* Hoje: entregas já concluídas para o dashboard nascer vivo */
  const todayDeliveries = 9;
  for (let i = 0; i < todayDeliveries; i++) {
    const km = Math.round(rnd(1.8, 8.2) * 10) / 10;
    const net = Math.round((5.5 + km * 2.3 + rnd(0, 2.5)) * 2) / 2;
    const { gross, fee } = grossFromNet(net);
    const ts = new Date(now);
    ts.setHours(10 + Math.floor(i * 0.9), Math.floor(rnd(5, 55)), 0);
    if (ts > now) ts.setTime(now.getTime() - i * 6 * 60000);
    txRows.push({
      courierId: main.id,
      type: "entrega",
      description: `Entrega • ${km.toFixed(1)} km`,
      amountGross: gross,
      feeAmount: fee,
      amountNet: net,
      km,
      createdAt: ts,
    });
  }
  await insertMany(transactions, txRows);

  /* Feed inicial de pedidos disponíveis */
  const initialOrders = Array.from({ length: 7 }, () => generateOrder());
  await insertMany(orders, initialOrders);

  /* Conversas iniciais do canal */
  const t = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000);
  const seedMessages: (typeof messages.$inferInsert)[] = [
    {
      courierId: partnerRows[0].id, channel: "Zona Sul", kind: "texto",
      content: "Bom dia, rapaziada! Quem tá na área do Campo Limpo hoje?",
      neighborhood: "Campo Limpo", createdAt: t(38),
    },
    {
      courierId: partnerRows[1].id, channel: "Zona Sul", kind: "texto",
      content: "Tô saindo agora, o almoço promete. Ontem fiz 14 corridas",
      neighborhood: "Vila Andrade", createdAt: t(31),
    },
    {
      courierId: partnerRows[4].id, channel: "Zona Sul", kind: "alerta", alertType: "blitz",
      content: "Blitz da PM na Av. Carlos Caldeira Filho, altura do nº 900. Documentos em dia, pessoal!",
      neighborhood: "Campo Limpo", lat: -23.6488, lng: -46.7631, createdAt: t(24),
    },
    {
      courierId: partnerRows[2].id, channel: "Zona Sul", kind: "audio", audioDurationSec: 9,
      content: "", neighborhood: "Capão Redondo", createdAt: t(17),
    },
    {
      courierId: partnerRows[3].id, channel: "Zona Sul", kind: "alerta", alertType: "restaurante",
      content: "Pizzaria Forno Alto tá demorando 25+ min pra liberar. Evitem por enquanto",
      neighborhood: "Vila Andrade", lat: -23.6271, lng: -46.7312, createdAt: t(11),
    },
    {
      courierId: partnerRows[5].id, channel: "Zona Sul", kind: "texto",
      content: "Alguém sabe se a Giovanni Gronchi já liberou? Tava travada mais cedo",
      neighborhood: "Morumbi", createdAt: t(6),
    },
    {
      courierId: partnerRows[0].id, channel: "Zona Sul", kind: "texto",
      content: "Liberou sim, passei lá agora. Fluxo normal",
      neighborhood: "Campo Limpo", createdAt: t(4),
    },
  ];
  await insertMany(messages, seedMessages);
}

export async function getMainCourier() {
  await ensureSeeded();
  const rows = await db.select().from(couriers).where(eq(couriers.isMain, true)).limit(1);
  return rows[0];
}

/**
 * Entregador da sessão (multiusuário): lê o header `x-courier-id`
 * (ou `?cid=`) enviado pelo app; sem sessão, usa a conta demonstração.
 */
export async function getSessionCourier(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const raw = req.headers.get("x-courier-id") ?? url.searchParams.get("cid");
  const id = raw ? parseInt(raw) : NaN;
  if (!Number.isNaN(id)) {
    const rows = await db.select().from(couriers).where(eq(couriers.id, id)).limit(1);
    if (rows[0]) return rows[0];
  }
  return getMainCourier();
}
