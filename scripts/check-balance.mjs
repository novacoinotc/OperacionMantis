import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const accounts = (await pool.query("select label, available_balance from client_accounts")).rows;
const deposits = (
  await pool.query(
    "select tracking_key, gross_amount, commission_amount, net_amount from deposits order by created_at desc limit 5",
  )
).rows;
const ledger = (
  await pool.query(
    "select account, sum(amount)::bigint as total from ledger_entries group by account order by account",
  )
).rows;

console.log("client_accounts:", accounts);
console.log("deposits:", deposits);
console.log("ledger_totals:", ledger);
await pool.end();
