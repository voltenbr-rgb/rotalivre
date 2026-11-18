export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtKm = (v: number) => `${v.toFixed(1).replace(".", ",")} km`;

export const fmtNum = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const STATUS_LABEL: Record<string, { label: string; classes: string; dot: string }> = {
  online: { label: "Online", classes: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30", dot: "bg-emerald-400" },
  em_entrega: { label: "Em entrega", classes: "bg-amber-400/15 text-amber-300 border-amber-400/30", dot: "bg-amber-400" },
  pausa: { label: "Em pausa", classes: "bg-zinc-400/15 text-zinc-300 border-zinc-400/30", dot: "bg-zinc-400" },
  offline: { label: "Offline", classes: "bg-red-400/15 text-red-300 border-red-400/30", dot: "bg-red-400" },
};

export const ALERT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  blitz: { label: "Blitz / Fiscalização", color: "text-sky-300", bg: "bg-sky-400/10", border: "border-sky-400/40" },
  alagamento: { label: "Rua alagada / bloqueada", color: "text-cyan-300", bg: "bg-cyan-400/10", border: "border-cyan-400/40" },
  risco: { label: "Área de risco", color: "text-amber-300", bg: "bg-amber-400/10", border: "border-amber-400/40" },
  restaurante: { label: "Restaurante atrasando", color: "text-orange-300", bg: "bg-orange-400/10", border: "border-orange-400/40" },
  sos: { label: "SOS — Socorro", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/50" },
};

export const INITIALS_COLORS = [
  "bg-lime-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-orange-500", "bg-cyan-600",
];

export function initialsOf(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function colorForId(id: number) {
  return INITIALS_COLORS[id % INITIALS_COLORS.length];
}
