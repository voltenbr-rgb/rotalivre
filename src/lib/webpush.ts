/**
 * Web Push sem bibliotecas externas (WebCrypto do Cloudflare Workers).
 * - VAPID (RFC 8292): assinatura ES256 que identifica o nosso servidor
 * - Criptografia do conteúdo (RFC 8291, aes128gcm)
 */

const enc = new TextEncoder();
const bs = (u: Uint8Array) => u as unknown as BufferSource;

export function b64u(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", bs(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: bs(salt), info: bs(info) },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

export async function generateVapidKeys(): Promise<VapidKeys> {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = (await crypto.subtle.exportKey("raw", kp.publicKey)) as ArrayBuffer;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey;
  return { publicKey: b64u(raw), privateJwk: jwk };
}

async function vapidHeader(endpoint: string, keys: VapidKeys, subject: string) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const { key_ops: _ops, ext: _ext, ...jwk } = keys.privateJwk;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bs(enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** Criptografa a mensagem para um aparelho (RFC 8291 / aes128gcm) */
async function encryptPayload(payload: Uint8Array, p256dh: string, auth: string) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);

  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", bs(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as EcdhKeyDeriveParams, local.privateKey, 256),
  );

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", bs(cek), "AES-GCM", false, ["encrypt"]);
  // 0x02 = delimitador do último (e único) registro
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce) }, aesKey, bs(concat(payload, new Uint8Array([2])))),
  );

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Envia uma notificação. Devolve o status HTTP do serviço de push (201 = ok; 404/410 = aparelho saiu). */
export async function sendWebPush(
  target: PushTarget,
  data: Record<string, unknown>,
  keys: VapidKeys,
  subject = "mailto:contato@rotalivre.app",
): Promise<number> {
  const body = await encryptPayload(enc.encode(JSON.stringify(data)), target.p256dh, target.auth);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(target.endpoint, keys, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "300",
      Urgency: "high",
    },
    body: bs(body),
  });
  return res.status;
}
