import { NextResponse } from "next/server";
import { db } from "@/db";
import { couriers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { MAIN_BASE } from "@/lib/domain";
import { createSession, deleteSession, publicCourier } from "@/lib/auth";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/**
 * Acesso multiusuário (cada login recebe uma chave de sessão própria):
 * - action "login": e-mail + senha. Conta antiga sem senha cria a senha no 1º acesso.
 * - action "register": cadastro completo de novo associado, com senha
 * - action "logout": invalida a chave deste aparelho
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "logout") {
    await deleteSession(req);
    return NextResponse.json({ ok: true });
  }

  if (action === "login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Informe seu e-mail" }, { status: 400 });
    const rows = await db.select().from(couriers).where(sql`lower(${couriers.email}) = lower(${email})`).limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { error: "E-mail não encontrado. Verifique ou crie sua conta de associado." },
        { status: 404 },
      );
    }
    const user = rows[0];
    const password = String(body.password ?? "");
    if (!user.passwordHash) {
      // Primeiro acesso de conta criada antes das senhas: define a senha agora
      const err = validatePassword(password);
      if (err) {
        return NextResponse.json({ error: `Primeiro acesso: crie uma senha. ${err}.`, needsPassword: true }, { status: 400 });
      }
      await db.update(couriers).set({ passwordHash: await hashPassword(password) }).where(eq(couriers.id, user.id));
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }
    const token = await createSession(user.id);
    return NextResponse.json({ courier: publicCourier(user), token });
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
    const password = String(body.password ?? "");
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    const existing = await db.select().from(couriers).where(sql`lower(${couriers.email}) = lower(${email})`).limit(1);
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
        photoUrl: "",
        passwordHash: await hashPassword(password),
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
        neighborhood: String(body.neighborhood ?? ""),
        city: String(body.city ?? "Corumbá"),
        state: String(body.state ?? "SP").toUpperCase(),
        workRadiusKm: Number(body.workRadiusKm ?? 8),
        dailyGoal: Number(body.dailyGoal ?? 200),
        baseLat: MAIN_BASE.lat + (Math.random() - 0.5) * 0.01,
        baseLng: MAIN_BASE.lng + (Math.random() - 0.5) * 0.01,
        rating: 5.0,
        totalDeliveries: 0,
      })
      .returning();

    const token = await createSession(created.id);
    return NextResponse.json({ courier: publicCourier(created), token });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
