import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { couriers, sessions } from "@/db/schema";
import { b64u } from "./webpush";

/** Sessão dura 60 dias; o motoboy não precisa ficar entrando toda hora */
const SESSION_DAYS = 60;

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64u(digest);
}

/** Cria uma chave de acesso nova (uma por aparelho/login) e devolve a chave em texto */
export async function createSession(accountId: number, accountType: "courier" | "store" = "courier") {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
  await db.insert(sessions).values({
    tokenHash: await sha256(token),
    accountType,
    accountId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
  });
  return token;
}

function tokenFrom(req: Request) {
  const authz = req.headers.get("authorization") ?? "";
  if (authz.toLowerCase().startsWith("bearer ")) return authz.slice(7).trim();
  // Links de download (ex.: exportar relatório) levam a chave na URL
  return new URL(req.url).searchParams.get("t");
}

export async function deleteSession(req: Request) {
  const token = tokenFrom(req);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
}

/**
 * Entregador da sessão (chave enviada pelo app em `Authorization: Bearer`).
 * Sem chave válida devolve null; a rota responde 401 e o app volta ao login.
 */
export async function getSessionCourier(req: Request) {
  const token = tokenFrom(req);
  if (!token) return null;
  const rows = await db
    .select({ courier: couriers })
    .from(sessions)
    .innerJoin(couriers, eq(couriers.id, sessions.accountId))
    .where(
      and(
        eq(sessions.tokenHash, await sha256(token)),
        eq(sessions.accountType, "courier"),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.courier ?? null;
}

/** Dados do entregador que podem ir para o app (sem o hash da senha) */
export function publicCourier<T extends { passwordHash?: string | null }>(c: T) {
  const { passwordHash: _omit, ...rest } = c;
  return rest;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
