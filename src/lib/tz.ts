/**
 * Fuso horário do usuário. O app manda o fuso do aparelho (ex.: America/Campo_Grande
 * em Corumbá) no cabeçalho X-Timezone; o "dia" dos relatórios segue esse fuso.
 */
export const DEFAULT_TZ = "America/Campo_Grande";
const DAY = 86400000;

export function tzFrom(req: Request) {
  const raw = req.headers.get("x-timezone") || new URL(req.url).searchParams.get("tz") || DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Diferença (ms) entre a hora local do fuso e o UTC, no instante `at` */
export function tzOffsetMs(tz: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - at.getTime()) / 60000) * 60000;
}

/** Instante (UTC) da meia-noite local do dia de `t` */
export function localDayStart(t: number, off: number) {
  return Math.floor((t + off) / DAY) * DAY - off;
}

export function localHour(t: number, off: number) {
  return new Date(t + off).getUTCHours();
}

export function localWeekday(t: number, off: number) {
  return new Date(t + off).getUTCDay();
}
