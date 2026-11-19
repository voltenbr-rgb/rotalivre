/**
 * Senhas com PBKDF2-SHA256 (WebCrypto). Formato salvo:
 *   pbkdf2$<iterações>$<sal base64url>$<hash base64url>
 * 100.000 iterações é o máximo aceito pelo Cloudflare Workers.
 */
import { b64u, fromB64u } from "./webpush";

const ITERATIONS = 100_000;
const enc = new TextEncoder();
const bs = (u: Uint8Array) => u as unknown as BufferSource;

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", bs(enc.encode(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bs(salt), iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64u(salt)}$${b64u(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltB64 || !hashB64) return false;
  const expected = fromB64u(hashB64);
  const actual = await derive(password, fromB64u(saltB64), parseInt(iter));
  if (actual.length !== expected.length) return false;
  // Comparação em tempo constante
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return "A senha precisa ter pelo menos 6 caracteres";
  if (pw.length > 128) return "Senha muito longa";
  return null;
}
