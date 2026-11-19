/**
 * Tira latitude/longitude de qualquer coisa que o cliente mande no WhatsApp:
 * - coordenadas: "-19.0089, -57.6527"
 * - graus/minutos/segundos do Google Maps: 19°00'32.0"S 57°39'09.7"W
 * - links do Google Maps: ...@-19.0,-57.6,17z  ?q=-19.0,-57.6  !3d-19.0!4d-57.6  /place/-19.0,-57.6
 */
export type LatLng = { lat: number; lng: number };

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export function parseLatLng(raw: string): LatLng | null {
  if (!raw) return null;
  let text = raw.trim();
  try {
    text = decodeURIComponent(text);
  } catch { /* mantém */ }
  text = text.replace(/\+/g, " ");

  // !3d<lat>!4d<lng> (posição exata do lugar no link longo)
  let m = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };

  // q= / query= / ll= / destination= / daddr=
  m = text.match(/[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };

  // /place/<lat>,<lng> ou /search/<lat>,<lng>
  m = text.match(/\/(?:place|search|dir)\/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };

  // @<lat>,<lng>
  m = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };

  // Graus, minutos, segundos: 19°00'32.0"S 57°39'09.7"W
  const dms = /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″]|'')?\s*([NSLOEW])/gi;
  const parts = [...text.matchAll(dms)];
  if (parts.length >= 2) {
    const conv = (p: RegExpMatchArray) => {
      const v = +p[1] + +p[2] / 60 + +p[3].replace(",", ".") / 3600;
      return /[SOW]/i.test(p[4]) ? -v : v;
    };
    const a = parts[0], b = parts[1];
    const latP = /[NS]/i.test(a[4]) ? a : b;
    const lngP = latP === a ? b : a;
    const lat = conv(latP), lng = conv(lngP);
    if (valid(lat, lng)) return { lat, lng };
  }

  // Coordenadas soltas: "-19.0089, -57.6527" (exige casas decimais para não pegar número de casa)
  m = text.match(/(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})/);
  if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] };

  return null;
}

/** Link curto do Google (maps.app.goo.gl, goo.gl/maps) precisa ser aberto no servidor */
export function isShortMapsLink(raw: string) {
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(raw);
}

export function firstUrl(raw: string) {
  return raw.match(/https?:\/\/\S+/i)?.[0] ?? null;
}
