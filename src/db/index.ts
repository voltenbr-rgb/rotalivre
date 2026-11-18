import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getTableColumns } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

type DB = DrizzleD1Database<typeof schema>;

const cache = new WeakMap<object, DB>();

/** Banco D1 da requisição atual (binding `DB` definido no wrangler.jsonc). */
export function getDb(): DB {
  const { env } = getCloudflareContext();
  const binding = (env as unknown as Record<string, object | undefined>).DB;
  if (!binding) {
    throw new Error("Binding D1 'DB' não encontrado. Confira o wrangler.jsonc.");
  }
  let instance = cache.get(binding);
  if (!instance) {
    instance = drizzle(binding as never, { schema });
    cache.set(binding, instance);
  }
  return instance;
}

/**
 * Mantém o `import { db } from "@/db"` do código original funcionando:
 * cada acesso resolve o D1 da requisição em andamento.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** O D1 aceita no máximo 100 parâmetros por consulta. */
const D1_MAX_PARAMS = 100;

/**
 * Insere muitas linhas em lotes que respeitam o limite do D1, numa única
 * ida ao banco (db.batch). Devolve as linhas inseridas, na mesma ordem.
 */
export async function insertMany<T extends SQLiteTable>(
  table: T,
  rows: T["$inferInsert"][],
): Promise<T["$inferSelect"][]> {
  if (rows.length === 0) return [];
  const columns = Object.keys(getTableColumns(table)).length;
  const perChunk = Math.max(1, Math.floor(D1_MAX_PARAMS / columns));
  const real = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: any[] = [];
  for (let i = 0; i < rows.length; i += perChunk) {
    statements.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      real.insert(table).values(rows.slice(i, i + perChunk) as any).returning(),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (await real.batch(statements as [any, ...any[]])) as T["$inferSelect"][][];
  return results.flat();
}
