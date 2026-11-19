import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginGuard } from "@/db/schema";

/** 5 senhas erradas seguidas = aguardar 10 minutos */
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 10;

export async function lockStatus(key: string) {
  const rows = await db.select().from(loginGuard).where(eq(loginGuard.key, key)).limit(1);
  const r = rows[0];
  if (r?.lockedUntil && r.lockedUntil.getTime() > Date.now()) {
    return { locked: true, minutes: Math.ceil((r.lockedUntil.getTime() - Date.now()) / 60000) };
  }
  return { locked: false, minutes: 0, fails: r?.fails ?? 0 };
}

/** Registra um erro; no 5º, trava por 10 min. Devolve quantas tentativas restam. */
export async function registerFail(key: string) {
  const rows = await db.select().from(loginGuard).where(eq(loginGuard.key, key)).limit(1);
  const expired = rows[0]?.lockedUntil && rows[0].lockedUntil.getTime() <= Date.now();
  const fails = (expired ? 0 : (rows[0]?.fails ?? 0)) + 1;
  const lock = fails >= MAX_FAILS;
  const values = {
    fails: lock ? 0 : fails,
    lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
  };
  await db
    .insert(loginGuard)
    .values({ key, ...values })
    .onConflictDoUpdate({ target: loginGuard.key, set: values });
  return { locked: lock, left: lock ? 0 : MAX_FAILS - fails };
}

export async function clearFails(key: string) {
  await db.delete(loginGuard).where(eq(loginGuard.key, key));
}

export function lockedMessage(minutes: number) {
  return `Muitas tentativas erradas. Aguarde ${minutes} min ou toque em "Esqueci minha senha".`;
}

export function failMessage(left: number) {
  return left > 0
    ? `E-mail ou senha incorretos. ${left} tentativa${left > 1 ? "s" : ""} antes de bloquear por ${LOCK_MINUTES} min.`
    : `Muitas tentativas erradas. Aguarde ${LOCK_MINUTES} min ou toque em "Esqueci minha senha".`;
}
