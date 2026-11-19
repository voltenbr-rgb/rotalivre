import { NextResponse } from "next/server";
import { getSessionStore, unauthorized } from "@/lib/auth";
import { firstUrl, isShortMapsLink, parseLatLng, type LatLng } from "@/lib/geoparse";

export const dynamic = "force-dynamic";

const ALLOWED = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+)$/i;

/** Segue o link curto do Google Maps (só domínios do Google) até achar as coordenadas */
async function resolveShort(url: string): Promise<LatLng | null> {
  let current = url;
  for (let i = 0; i < 6; i++) {
    const host = new URL(current).hostname;
    if (!ALLOWED.test(host)) return null;
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) RotaLivre", "Accept-Language": "pt-BR" },
    });
    const loc = res.headers.get("location");
    if (loc) {
      current = new URL(loc, current).toString();
      const p = parseLatLng(current);
      if (p) return p;
      continue;
    }
    // Sem redirecionamento: procura as coordenadas dentro da página
    const html = (await res.text()).slice(0, 400000);
    return parseLatLng(current) ?? parseLatLng(html.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s\\]+/)?.[0] ?? "") ??
      (() => {
        const m = html.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        return m ? { lat: +m[1], lng: +m[2] } : null;
      })();
  }
  return null;
}

/** Endereço aproximado do ponto (OpenStreetMap / Nominatim) */
async function reverse(p: LatLng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${p.lat}&lon=${p.lng}`,
      { headers: { "User-Agent": "RotaLivre/1.0 (rotalivre.voltenbr.workers.dev)", "Accept-Language": "pt-BR" } },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { address?: Record<string, string> };
    const a = d.address ?? {};
    const street = a.road || a.pedestrian || a.footway || a.residential || "";
    const address = [street, a.house_number].filter(Boolean).join(", ");
    const neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || "";
    return { address, neighborhood, city: a.city || a.town || a.municipality || "" };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const st = await getSessionStore(req);
  if (!st) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").slice(0, 2000);

  let point = parseLatLng(text);
  if (!point) {
    const url = firstUrl(text);
    if (url && isShortMapsLink(url)) {
      try {
        point = await resolveShort(url);
      } catch {
        point = null;
      }
    }
  }
  if (!point) {
    return NextResponse.json(
      { error: "Não achei a localização nesse texto. Cole o link do Google Maps ou as coordenadas (ex.: -19.0089, -57.6527)." },
      { status: 400 },
    );
  }
  const place = body.reverse === false ? null : await reverse(point);
  return NextResponse.json({ ...point, ...(place ?? {}) });
}
