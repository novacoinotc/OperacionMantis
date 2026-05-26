import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Carga variables locales para los comandos de drizzle-kit (push/migrate/studio).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // Conexión directa (sin pgbouncer) para DDL/migraciones.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
