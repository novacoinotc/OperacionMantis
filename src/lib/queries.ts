import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  brokerCommissions,
  clientAccounts,
  deposits,
  users,
  withdrawals,
  type ClientAccount,
} from "@/db/schema";
import { ledgerTotals } from "@/lib/ledger";

/* ── Cliente ───────────────────────────────────────────────────── */

export async function getClientAccountByUserId(userId: string): Promise<ClientAccount | null> {
  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.userId, userId))
    .limit(1);
  return acc ?? null;
}

export type Movement = {
  id: string;
  kind: "deposit" | "spei" | "usdt";
  date: Date;
  amount: number; // centavos con signo (neto que ve el cliente)
  status: string;
  detail: string;
  clabe: string | null; // CLABE de entrada (depósitos)
  // ── Detalle ──
  reference: string | null; // trackingKey (depósito) o externalReference (retiro)
  trackingKey: string | null; // clave de rastreo de NovaCore
  counterparty: string | null; // pagador (depósito) o beneficiario (retiro)
  counterpartyAccount: string | null;
  concept: string | null;
  usdtAmount: number | null; // micro-USDT
  usdtRate: string | null;
  usdtAddress: string | null;
  usdtTxHash: string | null;
};

/**
 * Movimientos del cliente. IMPORTANTE: los depósitos muestran SOLO el neto.
 * Si se pasa `clabe`, filtra a los depósitos de esa CLABE (histórico por CLABE).
 */
export async function getClientMovements(
  clientAccountId: string,
  opts?: { limit?: number; clabe?: string },
): Promise<Movement[]> {
  const limit = opts?.limit ?? 50;
  const depsWhere = opts?.clabe
    ? and(
        eq(deposits.clientAccountId, clientAccountId),
        eq(deposits.beneficiaryAccount, opts.clabe),
      )
    : eq(deposits.clientAccountId, clientAccountId);

  const [deps, wds] = await Promise.all([
    db.select().from(deposits).where(depsWhere).orderBy(desc(deposits.createdAt)).limit(limit),
    // Al filtrar por CLABE solo mostramos depósitos (los retiros no tienen CLABE de entrada).
    opts?.clabe
      ? Promise.resolve([])
      : db
          .select()
          .from(withdrawals)
          .where(eq(withdrawals.clientAccountId, clientAccountId))
          .orderBy(desc(withdrawals.createdAt))
          .limit(limit),
  ]);

  const movements: Movement[] = [
    ...deps.map((d) => ({
      id: d.id,
      kind: "deposit" as const,
      date: d.receivedAt ?? d.createdAt,
      // El cliente ve el depósito TAL CUAL llegó (bruto), para que cuadre con su
      // comprobante. La comisión se refleja solo en el saldo disponible (neto).
      amount: d.grossAmount,
      status: "settled",
      detail: d.payerName || "Depósito SPEI",
      clabe: d.beneficiaryAccount,
      reference: d.trackingKey,
      trackingKey: d.trackingKey,
      counterparty: d.payerName,
      counterpartyAccount: d.payerAccount,
      concept: d.concept,
      usdtAmount: null,
      usdtRate: null,
      usdtAddress: null,
      usdtTxHash: null,
    })),
    ...wds.map((w) => ({
      id: w.id,
      kind: (w.type === "spei" ? "spei" : "usdt") as "spei" | "usdt",
      date: w.createdAt,
      amount: -w.amount,
      status: w.status,
      detail:
        w.type === "spei"
          ? `Retiro SPEI · ${w.beneficiaryName || w.beneficiaryAccount || ""}`
          : "Conversión a USDT",
      clabe: null,
      reference: w.externalReference,
      trackingKey: w.novacoreTrackingKey,
      counterparty: w.beneficiaryName,
      counterpartyAccount: w.beneficiaryAccount,
      concept: w.concept,
      usdtAmount: w.usdtAmount,
      usdtRate: w.effectiveRate,
      usdtAddress: w.usdtAddress,
      usdtTxHash: w.usdtTxHash,
    })),
  ];

  movements.sort((a, b) => b.date.getTime() - a.date.getTime());
  return movements.slice(0, limit);
}

/* ── Broker ────────────────────────────────────────────────────── */

export type BrokerClientRow = {
  userId: string;
  name: string | null;
  email: string;
  availableBalance: number;
  isActive: boolean;
};

export async function getBrokerClients(brokerId: string): Promise<BrokerClientRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      availableBalance: clientAccounts.availableBalance,
    })
    .from(users)
    .leftJoin(clientAccounts, eq(clientAccounts.userId, users.id))
    .where(and(eq(users.brokerId, brokerId), eq(users.role, "user")))
    .orderBy(users.name);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    isActive: r.isActive,
    availableBalance: r.availableBalance ?? 0,
  }));
}

export type BrokerStats = {
  clientCount: number;
  totalClientBalance: number;
  commissionAccrued: number; // su comisión acumulada (NO el 4% del cliente)
  commissionPaid: number;
};

export async function getBrokerStats(brokerId: string): Promise<BrokerStats> {
  const clients = await getBrokerClients(brokerId);
  const [comm] = await db
    .select({
      accrued: sql<string>`coalesce(sum(case when ${brokerCommissions.status} = 'accrued' then ${brokerCommissions.amount} else 0 end), 0)::bigint`,
      paid: sql<string>`coalesce(sum(case when ${brokerCommissions.status} = 'paid' then ${brokerCommissions.amount} else 0 end), 0)::bigint`,
    })
    .from(brokerCommissions)
    .where(eq(brokerCommissions.brokerUserId, brokerId));

  return {
    clientCount: clients.length,
    totalClientBalance: clients.reduce((s, c) => s + c.availableBalance, 0),
    commissionAccrued: Number(comm?.accrued ?? 0),
    commissionPaid: Number(comm?.paid ?? 0),
  };
}

/** Detalle de un cliente para el broker. Solo si el cliente le pertenece. */
export async function getBrokerClientDetail(brokerId: string, clientUserId: string) {
  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      accountId: clientAccounts.id,
      availableBalance: clientAccounts.availableBalance,
    })
    .from(users)
    .innerJoin(clientAccounts, eq(clientAccounts.userId, users.id))
    .where(
      and(eq(users.id, clientUserId), eq(users.brokerId, brokerId), eq(users.role, "user")),
    )
    .limit(1);
  return row ?? null;
}

/* ── Admin ─────────────────────────────────────────────────────── */

export type AdminOverview = {
  ledger: Record<string, number>;
  deposits: { gross: number; commission: number; net: number; count: number };
  brokerPayable: number;
  pendingWithdrawals: number;
  accountsCount: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const [ledger, [dep], [bp], [pw], [ac]] = await Promise.all([
    ledgerTotals(),
    db
      .select({
        gross: sql<string>`coalesce(sum(${deposits.grossAmount}),0)::bigint`,
        commission: sql<string>`coalesce(sum(${deposits.commissionAmount}),0)::bigint`,
        net: sql<string>`coalesce(sum(${deposits.netAmount}),0)::bigint`,
        count: sql<string>`count(*)::int`,
      })
      .from(deposits),
    db
      .select({
        total: sql<string>`coalesce(sum(case when ${brokerCommissions.status} = 'accrued' then ${brokerCommissions.amount} else 0 end),0)::bigint`,
      })
      .from(brokerCommissions),
    db
      .select({ count: sql<string>`count(*)::int` })
      .from(withdrawals)
      .where(eq(withdrawals.status, "pending")),
    db.select({ count: sql<string>`count(*)::int` }).from(clientAccounts),
  ]);

  return {
    ledger,
    deposits: {
      gross: Number(dep?.gross ?? 0),
      commission: Number(dep?.commission ?? 0),
      net: Number(dep?.net ?? 0),
      count: Number(dep?.count ?? 0),
    },
    brokerPayable: Number(bp?.total ?? 0),
    pendingWithdrawals: Number(pw?.count ?? 0),
    accountsCount: Number(ac?.count ?? 0),
  };
}

export type AdminAccountRow = {
  accountId: string;
  label: string | null;
  clientName: string | null;
  clientEmail: string;
  clabe: string | null;
  availableBalance: number;
};

export type AdminWithdrawalRow = {
  id: string;
  type: "spei" | "usdt";
  status: string;
  amount: number;
  createdAt: Date;
  beneficiaryName: string | null;
  beneficiaryAccount: string | null;
  novacoreTrackingKey: string | null;
  usdtAmount: number | null;
  effectiveRate: string | null;
  usdtAddress: string | null;
  clientName: string | null;
  clientEmail: string;
};

export async function getAdminWithdrawals(type?: "spei" | "usdt"): Promise<AdminWithdrawalRow[]> {
  const rows = await db
    .select({
      id: withdrawals.id,
      type: withdrawals.type,
      status: withdrawals.status,
      amount: withdrawals.amount,
      createdAt: withdrawals.createdAt,
      beneficiaryName: withdrawals.beneficiaryName,
      beneficiaryAccount: withdrawals.beneficiaryAccount,
      novacoreTrackingKey: withdrawals.novacoreTrackingKey,
      usdtAmount: withdrawals.usdtAmount,
      effectiveRate: withdrawals.effectiveRate,
      usdtAddress: withdrawals.usdtAddress,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(withdrawals)
    .innerJoin(clientAccounts, eq(clientAccounts.id, withdrawals.clientAccountId))
    .innerJoin(users, eq(users.id, clientAccounts.userId))
    .where(type ? eq(withdrawals.type, type) : undefined)
    .orderBy(
      sql`case when ${withdrawals.status} in ('pending','processing') then 0 else 1 end`,
      desc(withdrawals.createdAt),
    )
    .limit(100);
  return rows;
}

export async function getAdminAccounts(): Promise<AdminAccountRow[]> {
  const rows = await db
    .select({
      accountId: clientAccounts.id,
      label: clientAccounts.label,
      clabe: clientAccounts.novacoreClabe,
      availableBalance: clientAccounts.availableBalance,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(clientAccounts)
    .innerJoin(users, eq(users.id, clientAccounts.userId))
    .orderBy(desc(clientAccounts.availableBalance));
  return rows;
}

export type AdminDepositRow = {
  id: string;
  payerName: string | null;
  beneficiaryAccount: string | null;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  commissionBps: number;
  receivedAt: Date | null;
  clientName: string | null;
  clientEmail: string;
};

export async function getAdminDeposits(limit = 100): Promise<AdminDepositRow[]> {
  return db
    .select({
      id: deposits.id,
      payerName: deposits.payerName,
      beneficiaryAccount: deposits.beneficiaryAccount,
      grossAmount: deposits.grossAmount,
      commissionAmount: deposits.commissionAmount,
      netAmount: deposits.netAmount,
      commissionBps: deposits.commissionBps,
      receivedAt: deposits.receivedAt,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(deposits)
    .innerJoin(clientAccounts, eq(clientAccounts.id, deposits.clientAccountId))
    .innerJoin(users, eq(users.id, clientAccounts.userId))
    .orderBy(desc(deposits.createdAt))
    .limit(limit);
}

/* ── Gestión de usuarios (admin) ───────────────────────────────── */

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "broker" | "user";
  isActive: boolean;
  brokerName: string | null;
  createdAt: Date;
};

export async function getAllUsers(): Promise<UserRow[]> {
  const brokerUser = alias(users, "broker_user");
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      brokerName: brokerUser.name,
      brokerEmail: brokerUser.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(brokerUser, eq(brokerUser.id, users.brokerId))
    .orderBy(users.role, users.createdAt);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    isActive: r.isActive,
    brokerName: r.brokerName ?? r.brokerEmail ?? null,
    createdAt: r.createdAt,
  }));
}

export async function getBrokersList(): Promise<{ id: string; name: string | null; email: string }[]> {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "broker"))
    .orderBy(users.name);
}
