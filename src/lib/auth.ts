import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { couriers, sessions, stores } from "@/db/schema";
import { b64u } from "./webpush";

/** Sessão dura 60 dias; o motoboy não precisa ficar entrando toda hora */
const SESSION_DAYS = 60;

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64u(digest);
}

/** Cria uma chave de acesso nova (uma por aparelho/login) e devolve a chave em texto */
export type AccountType = "courier" | "store" | "admin";

export async function createSession(accountId: number, accountType: AccountType = "courier") {
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

/** Conta da sessão de um tipo específico (loja ou master) */
async function sessionOf(req: Request, type: AccountType) {
  const token = tokenFrom(req);
  if (!token) return null;
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, await sha256(token)), eq(sessions.accountType, type), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

/** Loja da sessão (painel do lojista) */
export async function getSessionStore(req: Request) {
  const s = await sessionOf(req, "store");
  if (!s) return null;
  const rows = await db.select().from(stores).where(eq(stores.id, s.accountId)).limit(1);
  return rows[0] ?? null;
}

/** Sessão do painel master (senha master) */
export async function isAdmin(req: Request) {
  return !!(await sessionOf(req, "admin"));
}

/** Senha master: segredo ADMIN_PASSWORD na Cloudflare; "1989" até ser configurado */
export function adminPassword(): string {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    if (typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD) return env.ADMIN_PASSWORD;
  } catch { /* sem contexto */ }
  return "1989";
}

/** Dados da loja que podem ir para o app (sem o hash da senha) */
export function publicStore<T extends { passwordHash?: string | null }>(st: T) {
  const { passwordHash: _omit, ...rest } = st;
  return rest;
}

/** Dados do entregador que podem ir para o app (sem o hash da senha) */
export function publicCourier<T extends { passwordHash?: string | null }>(c: T) {
  const { passwordHash: _omit, ...rest } = c;
  return rest;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
}
