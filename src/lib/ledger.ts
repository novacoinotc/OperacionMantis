import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { clientAccounts, ledgerEntries } from "@/db/schema";

/**
 * Ledger de doble entrada. Cada `amount` es el delta CON SIGNO al saldo del
 * bucket (account, owner). El saldo de un bucket = suma de sus deltas.
 *
 * Convención de eventos:
 *  Depósito (bruto G, comisión C, neto N):
 *    core_cash +G · client_available[user] +N · platform_revenue +C
 *  Retiro SPEI liquidado (X neto):
 *    client_available[user] -X · core_cash -X
 *  Acumulación comisión broker (b):
 *    broker_payable[broker] +b · platform_revenue -b
 *  Conversión USDT (X neto):
 *    client_available[user] -X · usdt_payable[user] +X
 *  USDT pagado manualmente (X):
 *    usdt_payable[user] -X · platform_revenue +X
 *  Reembolso (retorno SPEI):
 *    client_available[user] +X · core_cash +X
 */

// Tipo del cliente DB o de una transacción (extraído de db.transaction).
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbClient = DB | Tx;

type LedgerAccountName =
  | "core_cash"
  | "client_available"
  | "platform_revenue"
  | "broker_payable"
  | "usdt_payable"
  | "pending_withdrawals";

export type LedgerLeg = {
  account: LedgerAccountName;
  amount: number; // centavos, con signo
  ownerUserId?: string | null;
  clientAccountId?: string | null;
  memo?: string;
};

/** Postea un grupo de entradas como una sola transacción del ledger. */
export async function postLedger(
  client: DbClient,
  opts: {
    entries: LedgerLeg[];
    refType: "deposit" | "withdrawal" | "commission" | "adjustment";
    refId?: string | null;
    txnId?: string;
  },
): Promise<string> {
  const txnId = opts.txnId ?? randomUUID();
  await client.insert(ledgerEntries).values(
    opts.entries.map((e) => ({
      txnId,
      account: e.account,
      ownerUserId: e.ownerUserId ?? null,
      clientAccountId: e.clientAccountId ?? null,
      amount: e.amount,
      refType: opts.refType,
      refId: opts.refId ?? null,
      memo: e.memo ?? null,
    })),
  );
  return txnId;
}

/** Ajusta el saldo neto cacheado del cliente (debe correr dentro de la misma tx). */
export async function bumpAvailableBalance(
  client: DbClient,
  clientAccountId: string,
  deltaCentavos: number,
): Promise<void> {
  await client
    .update(clientAccounts)
    .set({
      availableBalance: sql`${clientAccounts.availableBalance} + ${deltaCentavos}`,
      updatedAt: new Date(),
    })
    .where(eq(clientAccounts.id, clientAccountId));
}

/** Saldo de un bucket del ledger (suma de deltas). Útil para conciliación. */
export async function ledgerBalance(
  account: LedgerAccountName,
  ownerUserId?: string,
): Promise<number> {
  const where = ownerUserId
    ? and(eq(ledgerEntries.account, account), eq(ledgerEntries.ownerUserId, ownerUserId))
    : eq(ledgerEntries.account, account);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::bigint` })
    .from(ledgerEntries)
    .where(where);
  return Number(row?.total ?? 0);
}

/** Totales por cuenta (para el panel de admin / conciliación). */
export async function ledgerTotals(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      account: ledgerEntries.account,
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.account);
  return Object.fromEntries(rows.map((r) => [r.account, Number(r.total)]));
}
