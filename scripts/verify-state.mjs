import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const mxn = (c) => "$" + (Number(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

const acc = (await pool.query("select id, available_balance from client_accounts where novacore_api_key_prefix='ncapi-a3'")).rows[0];
console.log("MACAIBA saldo disponible (neto):", mxn(acc.available_balance));

const dep = (await pool.query(
  "select count(*) n, coalesce(sum(gross_amount),0) g, coalesce(sum(commission_amount),0) c, coalesce(sum(net_amount),0) net from deposits where client_account_id=$1",
  [acc.id],
)).rows[0];
console.log(`\nDEPÓSITOS: ${dep.n} | bruto ${mxn(dep.g)} | comisión 4% ${mxn(dep.c)} | neto ${mxn(dep.net)}`);

const sample = (await pool.query(
  "select payer_name, gross_amount, commission_amount, net_amount from deposits where client_account_id=$1 order by created_at desc limit 4",
  [acc.id],
)).rows;
console.table(sample.map((r) => ({ payer: r.payer_name, bruto: mxn(r.gross_amount), comision: mxn(r.commission_amount), neto: mxn(r.net_amount) })));

const wd = (await pool.query(
  "select type, status, amount, broker_commission, broker_bps from withdrawals where client_account_id=$1 order by created_at desc",
  [acc.id],
)).rows;
console.log("\nRETIROS:");
console.table(wd.map((r) => ({ tipo: r.type, estado: r.status, monto: mxn(r.amount), comBroker: mxn(r.broker_commission), bps: r.broker_bps })));

const bc = (await pool.query("select type, status, amount, bps from broker_commissions")).rows;
console.log("\nCOMISIONES BROKER (broker_commissions):", bc.length, "filas");
console.table(bc.map((r) => ({ tipo: r.type, estado: r.status, monto: mxn(r.amount), bps: r.bps })));

const ledger = (await pool.query("select account, sum(amount)::bigint total from ledger_entries group by account order by account")).rows;
console.log("\nLEDGER:");
console.table(ledger.map((r) => ({ cuenta: r.account, total: mxn(r.total) })));

await pool.end();
