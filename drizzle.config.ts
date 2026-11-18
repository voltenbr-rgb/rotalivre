import { defineConfig } from "drizzle-kit";

// Gera migrações SQL em ./drizzle a partir de src/db/schema.ts.
// Para aplicar no D1 use: npm run db:migrate:remote (ou :local)
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
