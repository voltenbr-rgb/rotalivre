// Ponto de entrada do Worker: o app Next.js (OpenNext) + tarefas agendadas.
// O arquivo .open-next/worker.js é gerado pelo build (npm run cf).
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  /**
   * Cron Trigger (wrangler.jsonc → triggers.crons): a cada 30 min chama a rota
   * de simulação de corrida, que cria um pedido de teste e envia o push.
   */
  async scheduled(_controller, env, ctx) {
    const row = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'cron_token'").first();
    if (!row) return;
    const req = new Request("https://rotalivre.internal/api/cron/simulate", {
      method: "POST",
      headers: { "x-cron-token": String(row.value) },
    });
    ctx.waitUntil(
      handler.fetch(req, env, ctx).then(async (res) => {
        console.log("cron simulate:", res.status, await res.text());
      }),
    );
  },
};
