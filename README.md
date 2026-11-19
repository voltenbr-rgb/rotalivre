# RotaLivre — Hub do Entregador

App Next.js (PWA) rodando na Cloudflare: **Workers** (via [OpenNext](https://opennext.js.org/cloudflare)) + banco **D1** (`rotalivre`).

## Rodar localmente

```bash
npm install
npm run db:migrate:local   # cria as tabelas no D1 local
npm run dev                # http://localhost:3000
```

Os dados de demonstração são criados sozinhos na primeira requisição.

## Deploy na Cloudflare (pelo GitHub)

1. Painel da Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → escolha `rotalivre`.
2. Configuração do build:
   - **Build command:** `npm run cf`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
3. Salve. A cada push na `main`, a Cloudflare publica de novo.

O banco D1 já está ligado pelo `wrangler.jsonc` (binding `DB`).

> Observação: Next.js com rotas de API não roda no Cloudflare *Pages* clássico; a Cloudflare recomenda Workers + OpenNext, que tem a mesma integração com o GitHub.

## Mapa e GPS

- O GPS real do celular liga sozinho depois da primeira permissão (`src/lib/useGeolocation.ts`).
- A posição vai para `POST /api/courier/location` a cada ~15 s ou ~30 m.
- Sem GPS, o mapa entra em **modo simulado** (demonstração).
- Durante uma entrega a tela fica acesa (Wake Lock). Confirmar a coleta ou a entrega a mais de 250 m do ponto pede um segundo toque.
- Limitação de PWA: com a tela apagada ou o app em segundo plano o navegador **não envia** a posição.

## Banco de dados

- Schema: `src/db/schema.ts` (Drizzle, SQLite/D1)
- Migrações: pasta `drizzle/`
- Aplicar no banco de produção: `npm run db:migrate:remote`
