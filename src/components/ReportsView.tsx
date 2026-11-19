"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  CalendarRange, Coins, Download, FileText, Flag, Gauge, HandCoins,
  PackageCheck, Percent, Route, TrendingDown, TrendingUp, Trophy,
} from "lucide-react";
import type { ReportData } from "@/lib/types";
import { fmtBRL, fmtKm, fmtNum } from "@/lib/format";
import { apiFetch, getToken } from "@/lib/session";

const PERIODS = [
  { v: 1, label: "Hoje" },
  { v: 15, label: "15 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
] as const;

interface Props {
  notify: (msg: string, tone?: "ok" | "warn" | "sos") => void;
}

export default function ReportsView({ notify }: Props) {
  const [period, setPeriod] = useState<number>(30);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/reports?period=${p}`);
      const data = await res.json();
      setReport(data.report);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const exportPdf = async () => {
    if (!report) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const t = report.totals;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("RotaLivre — Relatório Financeiro", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Período: últimos ${report.period} dia(s) • Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 25);
    doc.setFontSize(11);
    const lines = [
      `Total líquido recebido: ${fmtBRL(t.net)}`,
      `Total bruto: ${fmtBRL(t.gross)}`,
      `Taxa transparente (5%): ${fmtBRL(t.fees)}`,
      `Gorjetas (sem taxa): ${fmtBRL(t.tips)}`,
      `Entregas concluídas: ${t.deliveries}`,
      `Km rodados: ${t.km.toFixed(1)}`,
      `Ticket médio: ${fmtBRL(t.avgTicket)}`,
      `Média diária: ${fmtBRL(t.dailyAverage)}`,
    ];
    lines.forEach((l, i) => doc.text(l, 14, 36 + i * 6));
    let y = 36 + lines.length * 6 + 8;
    doc.setFont("helvetica", "bold");
    doc.text(report.period === 1 ? "Hora | Líquido | Entregas" : "Data | Líquido | Entregas | Km", 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    for (const s of report.series) {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(`${s.label} | ${fmtBRL(s.net)} | ${s.deliveries} | ${s.km.toFixed(1)} km`, 14, y);
      y += 5.5;
    }
    doc.save(`rotalivre-relatorio-${report.period}dias.pdf`);
    notify("PDF do relatório gerado");
  };

  const r = report;
  const t = r?.totals;

  return (
    <div className="mx-auto w-full max-w-[520px] space-y-5 px-4 pt-4 pb-2 lg:max-w-5xl lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-white">Relatórios</h2>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          <Percent className="h-3 w-3" /> Taxa fixa de 5%, sem surpresas
        </span>
      </div>

      {/* Filtros temporais obrigatórios */}
      <div className="grid grid-cols-4 gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.v}
            onClick={() => setPeriod(p.v)}
            className={`rounded-2xl py-3 text-sm font-extrabold transition active:scale-95 ${
              period === p.v ? "bg-lime-400 text-zinc-950 shadow-[0_8px_22px_rgba(163,230,53,0.3)]" : "border border-white/10 bg-white/4 text-zinc-400"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && !r ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/4" />
          ))}
        </div>
      ) : r && t ? (
        <>
          {/* KPIs */}
          <section className="rounded-3xl border border-white/8 bg-[#101319] p-4">
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Total líquido {period === 1 ? "de hoje" : `em ${period} dias`}
            </p>
            <p className="font-display text-[38px] leading-tight font-black text-emerald-400 tabular-nums">{fmtBRL(t.net)}</p>
            {/* Bruto → taxa → líquido: transparência total */}
            <div className="mt-2 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between text-zinc-400"><span>Bruto das corridas</span><span className="text-zinc-200 tabular-nums">{fmtBRL(t.gross)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-zinc-500" style={{ width: "100%" }} />
              </div>
              <div className="flex justify-between text-zinc-400"><span>Taxa transparente RotaLivre (5%)</span><span className="text-red-300 tabular-nums">− {fmtBRL(t.fees)}</span></div>
              <div className="flex justify-between text-zinc-400"><span>Gorjetas (100% suas, sem taxa)</span><span className="text-lime-300 tabular-nums">+ {fmtBRL(t.tips)}</span></div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Kpi icon={<PackageCheck className="h-4 w-4 text-emerald-300" />} label="Entregas" value={fmtNum(t.deliveries)} />
            <Kpi icon={<Route className="h-4 w-4 text-amber-300" />} label="Km rodados" value={fmtKm(t.km)} />
            <Kpi icon={<Coins className="h-4 w-4 text-sky-300" />} label="Ticket médio" value={fmtBRL(t.avgTicket)} />
            <Kpi icon={<CalendarRange className="h-4 w-4 text-teal-300" />} label="Média por dia" value={fmtBRL(t.dailyAverage)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
          {/* Gráfico de ganhos */}
          <section className="rounded-3xl border border-white/8 bg-[#101319] p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              <HandCoins className="h-4 w-4 text-lime-400" />
              {period === 1 ? "Ganhos por hora (R$)" : period === 90 ? "Ganhos por semana (R$)" : "Ganhos por dia (R$)"}
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.series} margin={{ top: 4, right: 2, bottom: 0, left: -14 }}>
                  <CartesianGrid stroke="#1e242e" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={{ stroke: "#232833" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="net" name="Líquido" stroke="#a3e635" strokeWidth={2.5} fill="#a3e635" fillOpacity={0.14} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Gráfico de entregas */}
          <section className="rounded-3xl border border-white/8 bg-[#101319] p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
              <PackageCheck className="h-4 w-4 text-emerald-400" /> Entregas concluídas
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.series} margin={{ top: 4, right: 2, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke="#1e242e" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={{ stroke: "#232833" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="deliveries" name="Entregas" fill="#34d399" radius={[5, 5, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          </div>

          {/* Insights por período */}
          <section className="space-y-2.5">
            {period === 1 && r.peakHour && (
              <Insight icon={<Flag className="h-5 w-5 text-amber-300" />} title="Horário de pico de hoje" body={`Janela mais rentável: ${r.peakHour}. Posicione-se perto dos restaurantes nesse horário.`} />
            )}

            {period === 15 && r.weekCompare && (
              <div className="rounded-3xl border border-white/8 bg-[#101319] p-4">
                <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
                  {r.weekCompare.deltaPercent >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                  Comparativo quinzenal
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-white/4 p-3">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Semana 1</p>
                    <p className="font-display text-lg font-extrabold text-white tabular-nums">{fmtBRL(r.weekCompare.first)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/4 p-3">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Semana 2</p>
                    <p className="font-display text-lg font-extrabold text-white tabular-nums">{fmtBRL(r.weekCompare.second)}</p>
                  </div>
                </div>
                <p className={`mt-2.5 text-sm font-bold ${r.weekCompare.deltaPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {r.weekCompare.deltaPercent >= 0 ? "▲" : "▼"} {Math.abs(r.weekCompare.deltaPercent).toFixed(1).replace(".", ",")}% em relação à primeira semana
                </p>
              </div>
            )}

            {period === 30 && r.projection !== null && (
              <Insight
                icon={<Gauge className="h-5 w-5 text-sky-300" />}
                title="Projeção de fechamento do mês"
                body={`No seu ritmo atual (${fmtBRL(t.dailyAverage)}/dia), o mês fecha em aproximadamente ${fmtBRL(r.projection)} líquidos.`}
              />
            )}
            {period === 30 && r.bestWeekdays && (
              <div className="rounded-3xl border border-white/8 bg-[#101319] p-4">
                <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 uppercase">
                  <Trophy className="h-4 w-4 text-amber-300" /> Dias mais rentáveis
                </p>
                <div className="mt-3 space-y-2">
                  {r.bestWeekdays.map((d, i) => (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className={`w-8 text-sm font-extrabold ${i === 0 ? "text-amber-300" : "text-zinc-400"}`}>{d.day}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${i === 0 ? "bg-amber-400" : "bg-lime-500/70"}`} style={{ width: `${Math.min(100, (d.avg / (r.bestWeekdays![0].avg || 1)) * 100)}%` }} />
                      </div>
                      <span className="w-24 text-right text-sm font-bold text-white tabular-nums">{fmtBRL(d.avg)}/dia</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {period === 90 && r.growthPercent !== null && (
              <Insight
                icon={r.growthPercent >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-300" /> : <TrendingDown className="h-5 w-5 text-red-300" />}
                title="Evolução trimestral"
                body={`Seus ganhos dos últimos 30 dias estão ${Math.abs(r.growthPercent).toFixed(1).replace(".", ",")}% ${r.growthPercent >= 0 ? "acima" : "abaixo"} dos primeiros 30 dias do trimestre. Total acumulado no período: ${fmtBRL(t.net)}.`}
              />
            )}

            {r.bestDay && period !== 1 && (
              <Insight
                icon={<Trophy className="h-5 w-5 text-amber-300" />}
                title="Seu melhor dia"
                body={`${r.bestDay.label} — ${fmtBRL(r.bestDay.net)} líquidos em um único dia. Replique a estratégia: região, horários e tipos de corrida.`}
              />
            )}
          </section>

          {/* Exportação */}
          <section className="grid grid-cols-2 gap-2.5 pb-2">
            <a
              href={`/api/reports/export?period=${period}&t=${encodeURIComponent(getToken() ?? "")}`}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 text-sm font-extrabold text-white transition active:scale-95"
            >
              <Download className="h-5 w-5 text-lime-400" /> Exportar CSV
            </a>
            <button
              onClick={exportPdf}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-lime-400 text-sm font-black text-zinc-950 shadow-[0_10px_26px_rgba(163,230,53,0.3)] transition active:scale-95"
            >
              <FileText className="h-5 w-5" /> Exportar PDF
            </button>
          </section>
        </>
      ) : (
        !loading && <p className="py-10 text-center text-sm text-zinc-500">Sem dados para o período selecionado.</p>
      )}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-[#101319] p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">{icon} {label}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-white tabular-nums">{value}</p>
    </div>
  );
}

function Insight({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-3xl border border-white/8 bg-[#101319] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#171b23] px-3 py-2 shadow-xl">
      <p className="text-[11px] font-bold text-zinc-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-extrabold text-white tabular-nums">
          {p.name === "Líquido" ? fmtBRL(p.value) : `${p.value} entregas`}
        </p>
      ))}
    </div>
  );
}
