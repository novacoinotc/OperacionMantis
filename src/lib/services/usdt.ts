import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  brokerCommissions,
  clientAccounts,
  usdtQuotes,
  users,
  withdrawals,
  type ClientAccount,
  type Withdrawal,
} from "@/db/schema";
import { applyBps, effectiveRate, grossEquivalent, usdtFromMxn } from "@/lib/money";
import { bumpAvailableBalance, postLedger } from "@/lib/ledger";
import { fetchBitsoTicker } from "@/lib/bitso";

export type UsdtQuote = {
  bid: number;
  ask: number;
  last: number;
  base: number;
  markupCentavos: number;
  effectiveRate: number;
};

/** Cotización: precio de Bitso + markup (5¢). Base = ask (precio de compra). */
export async function getUsdtQuote(markupCentavos = 5): Promise<UsdtQuote> {
  const t = await fetchBitsoTicker();
  const base = t.ask || t.last;
  return {
    bid: t.bid,
    ask: t.ask,
    last: t.last,
    base,
    markupCentavos,
    effectiveRate: effectiveRate(base, markupCentavos),
  };
}

export async function createUsdtOrder(input: {
  account: ClientAccount;
  requestedByUserId: string;
  amountCentavos: number;
  usdtAddress: string;
  usdtNetwork?: string;
}): Promise<Withdrawal> {
  const { account, amountCentavos: amount } = input;
  if (amount <= 0) throw new Error("Monto inválido.");
  if (amount > account.maxAmountPerOperation) {
    throw new Error("El monto excede el máximo por operación.");
  }

  const t = await fetchBitsoTicker();
  const base = t.ask || t.last;
  const markup = account.usdtMarkupCentavos;
  const rate = effectiveRate(base, markup);
  const usdtAmount = usdtFromMxn(amount, rate);
  const gEquiv = grossEquivalent(amount, account.commissionBps);
  const externalReference = `usdt-${Date.now()}-${randomUUID().slice(0, 8)}`;

  return db.transaction(async (tx) => {
    await tx.insert(usdtQuotes).values({
      book: t.book,
      bid: String(t.bid),
      ask: String(t.ask),
      last: String(t.last),
      raw: t,
    });

    const reserved = await tx
      .update(clientAccounts)
      .set({
        availableBalance: sql`${clientAccounts.availableBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(clientAccounts.id, account.id), sql`${clientAccounts.availableBalance} >= ${amount}`),
      )
      .returning({ id: clientAccounts.id });
    if (reserved.length === 0) throw new Error("Saldo insuficiente.");

    const [wd] = await tx
      .insert(withdrawals)
      .values({
        clientAccountId: account.id,
        type: "usdt",
        status: "pending",
        externalReference,
        amount,
        grossEquivalent: gEquiv,
        requestedByUserId: input.requestedByUserId,
        bitsoRate: String(base),
        markupCentavos: markup,
        effectiveRate: String(rate),
        usdtAmount,
        usdtAddress: input.usdtAddress,
        usdtNetwork: input.usdtNetwork ?? "TRC20",
      })
      .returning();

    await postLedger(tx, {
      refType: "withdrawal",
      refId: wd.id,
      entries: [
        {
          account: "client_available",
          amount: -amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "Reserva por conversión a USDT",
        },
        {
          account: "usdt_payable",
          amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "USDT por entregar (manual)",
        },
      ],
    });

    return wd;
  });
}

export async function completeUsdtOrder(input: {
  withdrawalId: string;
  adminUserId: string;
  usdtTxHash?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, input.withdrawalId))
    .limit(1);
  if (!wd || wd.type !== "usdt" || !(wd.status === "pending" || wd.status === "processing")) {
    return { ok: false, error: "La orden no es procesable." };
  }
  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, wd.clientAccountId))
    .limit(1);
  if (!account) return { ok: false, error: "Cuenta no encontrada." };
  const [clientUser] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);

  await db.transaction(async (tx) => {
    await tx
      .update(withdrawals)
      .set({
        status: "completed",
        processedByUserId: input.adminUserId,
        processedAt: new Date(),
        usdtTxHash: input.usdtTxHash ?? null,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, wd.id));

    // El MXN reservado queda como ingreso (el USDT se pagó fuera del core).
    await postLedger(tx, {
      refType: "withdrawal",
      refId: wd.id,
      entries: [
        {
          account: "usdt_payable",
          amount: -wd.amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "USDT entregado",
        },
        {
          account: "platform_revenue",
          amount: wd.amount,
          clientAccountId: account.id,
          memo: "MXN retenido (USDT pagado externamente)",
        },
      ],
    });

    if (clientUser?.brokerId) {
      const bps = account.brokerCryptoBps;
      const commission = applyBps(wd.grossEquivalent, bps);
      if (commission > 0) {
        await tx.insert(brokerCommissions).values({
          brokerUserId: clientUser.brokerId,
          clientAccountId: account.id,
          withdrawalId: wd.id,
          type: "usdt",
          amount: commission,
          bps,
          status: "accrued",
        });
        await tx
          .update(withdrawals)
          .set({ brokerCommission: commission, brokerBps: bps })
          .where(eq(withdrawals.id, wd.id));
        await postLedger(tx, {
          refType: "commission",
          refId: wd.id,
          entries: [
            {
              account: "broker_payable",
              amount: commission,
              ownerUserId: clientUser.brokerId,
              clientAccountId: account.id,
              memo: "Comisión broker USDT",
            },
            {
              account: "platform_revenue",
              amount: -commission,
              clientAccountId: account.id,
              memo: "Comisión broker USDT (gasto)",
            },
          ],
        });
      }
    }
  });

  return { ok: true };
}

export async function rejectUsdtOrder(input: {
  withdrawalId: string;
  adminUserId: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, input.withdrawalId))
    .limit(1);
  if (!wd || wd.type !== "usdt" || !(wd.status === "pending" || wd.status === "processing")) {
    return { ok: false, error: "La orden no es procesable." };
  }
  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, wd.clientAccountId))
    .limit(1);
  if (!account) return { ok: false, error: "Cuenta no encontrada." };

  await db.transaction(async (tx) => {
    await tx
      .update(withdrawals)
      .set({
        status: "rejected",
        processedByUserId: input.adminUserId,
        processedAt: new Date(),
        rejectionReason: input.reason ?? "Rechazada por admin",
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, wd.id));

    await postLedger(tx, {
      refType: "withdrawal",
      refId: wd.id,
      entries: [
        {
          account: "usdt_payable",
          amount: -wd.amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "Reverso USDT",
        },
        {
          account: "client_available",
          amount: wd.amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "Reembolso a disponible",
        },
      ],
    });
    await bumpAvailableBalance(tx, account.id, wd.amount);
  });

  return { ok: true };
}
