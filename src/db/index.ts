import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

/**
 * Cliente de base de datos (Neon serverless con WebSocket → soporta
 * transacciones interactivas, necesarias para el ledger de doble entrada).
 * En Node.js hay que pasarle un constructor de WebSocket explícito.
 */
neonConfig.webSocketConstructor = ws;

const globalForDb = globalThis as unknown as { __mantisPool?: Pool };

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL en el entorno.");
  }
  return new Pool({ connectionString });
}

const pool = globalForDb.__mantisPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.__mantisPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export { schema };
export type DB = typeof db;
