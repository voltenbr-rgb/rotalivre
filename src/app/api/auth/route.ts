import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers, messages } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import { ensureSeeded, getMainCourier } from "@/lib/seed";
import { MAIN_BASE } from "@/lib/domain";

export const dynamic = "force-dynamic";

/**
 * Acesso multiusuário:
 * - action "demo": entra na conta de demonstração (Rafael "Fumaça")
 * - action "login": entra com o e-mail cadastrado
 * - action "register": cadastro completo de novo associado
 */
export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  const action = body.action as string;

  if (action === "demo") {
    const main = await getMainCourier();
    return NextResponse.json({ courier: main });
  }

  if (action === "login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Informe seu e-mail" }, { status: 400 });
    const rows = await db.select().from(couriers).where(ilike(couriers.email, email)).limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { error: "E-mail não encontrado. Verifique ou crie sua conta de associado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ courier: rows[0] });
  }

  if (action === "register") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const plate = String(body.vehiclePlate ?? "").trim().toUpperCase().replace("-", "");
    if (name.length < 3) return NextResponse.json({ error: "Informe seu nome completo" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }
    if (!(/^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate))) {
      return NextResponse.json({ error: "Placa inválida (use AAA0000 ou AAA0A00)" }, { status: 400 });
    }
    const existing = await db.select().from(couriers).where(ilike(couriers.email, email)).limit(1);
    if (existing[0]) {
      return NextResponse.json(
        { error: "Este e-mail já é de um associado. Use a opção Entrar." },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(couriers)
      .values({
        isMain: false,
        name,
        nickname: String(body.nickname ?? "").trim() || name.split(" ")[0],
        email,
        phone: String(body.phone ?? ""),
        cpf: String(body.cpf ?? ""),
        birthDate: String(body.birthDate ?? ""),
        photoUrl: String(body.photoUrl ?? ""),
        status: "online",
        vehicleModel: String(body.vehicleModel ?? ""),
        vehiclePlate: plate,
        vehicleYear: String(body.vehicleYear ?? ""),
        vehicleColor: String(body.vehicleColor ?? ""),
        cnhNumber: String(body.cnhNumber ?? ""),
        cnhCategory: String(body.cnhCategory ?? "AB"),
        cnhExpiry: String(body.cnhExpiry ?? ""),
        cep: String(body.cep ?? ""),
        street: String(body.street ?? ""),
        number: String(body.number ?? ""),
        neighborhood: String(body.neighborhood ?? "Campo Limpo"),
        city: String(body.city ?? "São Paulo"),
        state: String(body.state ?? "SP").toUpperCase(),
        workRadiusKm: Number(body.workRadiusKm ?? 8),
        dailyGoal: Number(body.dailyGoal ?? 200),
        baseLat: MAIN_BASE.lat + (Math.random() - 0.5) * 0.01,
        baseLng: MAIN_BASE.lng + (Math.random() - 0.5) * 0.01,
        rating: 5.0,
        totalDeliveries: 0,
      })
      .returning();

    // Boas-vindas da rede no canal regional
    const main = await getMainCourier();
    await db.insert(messages).values({
      courierId: main.id,
      channel: "Zona Sul",
      kind: "texto",
      content: `Salve, rede! Tem associado novo na praça: ${created.name.split(" ")[0]} "${created.nickname}" acabou de entrar. Bem-vindo(a) ao RotaLivre!`,
      neighborhood: created.neighborhood,
    });

    return NextResponse.json({ courier: created });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
