import { getSessionCourier } from "@/lib/seed";
import { computeReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Exportação CSV do relatório (diário ou por hora, conforme o período) */
export async function GET(req: Request) {
  const main = await getSessionCourier(req);
  const period = parseInt(new URL(req.url).searchParams.get("period") ?? "30");
  const valid = [1, 15, 30, 90].includes(period) ? period : 30;
  const report = await computeReport(main.id, valid);

  const lines: string[] = [];
  lines.push(`Relatório RotaLivre;Período (dias);${valid}`);
  lines.push(`Entregador;${main.name} (${main.nickname})`);
  lines.push(`Gerado em;${new Date().toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push("Data;Entregas;Km;Bruto (R$);Taxa transparente (R$);Líquido (R$)");
  for (const s of report.series) {
    const brutoEstimado = s.net > 0 ? (s.net / 0.95).toFixed(2) : "0.00";
    const taxa = s.net > 0 ? (s.net / 0.95 - s.net).toFixed(2) : "0.00";
    lines.push(
      `${s.label};${s.deliveries};${s.km.toFixed(1).replace(".", ",")};${brutoEstimado.replace(".", ",")};${taxa.replace(".", ",")};${s.net.toFixed(2).replace(".", ",")}`,
    );
  }
  lines.push("");
  lines.push(
    `TOTAL;${report.totals.deliveries};${report.totals.km.toFixed(1).replace(".", ",")};${report.totals.gross.toFixed(2).replace(".", ",")};${report.totals.fees.toFixed(2).replace(".", ",")};${report.totals.net.toFixed(2).replace(".", ",")}`,
  );
  lines.push(`Gorjetas (sem taxa);;;; ;${report.totals.tips.toFixed(2).replace(".", ",")}`);
  lines.push(`Média diária;;;;;${report.totals.dailyAverage.toFixed(2).replace(".", ",")}`);
  lines.push(`Ticket médio;;;;;${report.totals.avgTicket.toFixed(2).replace(".", ",")}`);

  const csv = "\uFEFF" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rotalivre-relatorio-${valid}dias.csv"`,
    },
  });
}
