import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  brokerCommissions,
  clientAccounts,
  users,
  withdrawals,
  type ClientAccount,
  type Withdrawal,
} from "@/db/schema";
import { applyBps, centavosToPesos, grossEquivalent } from "@/lib/money";
import { bumpAvailableBalance, postLedger, type Tx } from "@/lib/ledger";
import { coreClientFor } from "@/lib/novacore";

/* Reembolsa la reserva al disponible (reverso de pending_withdrawals). */
async function refundReserve(tx: Tx, account: ClientAccount, amount: number, wdId: string) {
  await postLedger(tx, {
    refType: "withdrawal",
    refId: wdId,
    entries: [
      {
        account: "pending_withdrawals",
        amount: -amount,
        ownerUserId: account.userId,
        clientAccountId: account.id,
        memo: "Reverso de reserva",
      },
      {
        account: "client_available",
        amount,
        ownerUserId: account.userId,
        clientAccountId: account.id,
        memo: "Reembolso a disponible",
      },
    ],
  });
  await bumpAvailableBalance(tx, account.id, amount);
}

/* Revierte la comisión del broker acumulada para un retiro (si la hubo). */
async function reverseBrokerCommission(tx: Tx, account: ClientAccount, wd: Withdrawal) {
  if (!wd.brokerCommission || wd.brokerCommission <= 0) return;
  const [comm] = await db
    .select()
    .from(brokerCommissions)
    .where(and(eq(brokerCommissions.withdrawalId, wd.id), eq(brokerCommissions.status, "accrued")))
    .limit(1);
  if (!comm) return;

  await postLedger(tx, {
    refType: "commission",
    refId: wd.id,
    entries: [
      {
        account: "broker_payable",
        amount: -comm.amount,
        ownerUserId: comm.brokerUserId,
        clientAccountId: account.id,
        memo: "Reverso comisión broker",
      },
      {
        account: "platform_revenue",
        amount: comm.amount,
        clientAccountId: account.id,
        memo: "Reverso comisión broker",
      },
    ],
  });
  await tx.delete(brokerCommissions).where(eq(brokerCommissions.id, comm.id));
  await tx.update(withdrawals).set({ brokerCommission: 0, brokerBps: 0 }).where(eq(withdrawals.id, wd.id));
}

/* ── Solicitud (cliente) ───────────────────────────────────────── */

export type RequestSpeiInput = {
  account: ClientAccount;
  requestedByUserId: string;
  amountCentavos: number;
  beneficiaryAccount: string;
  beneficiaryName: string;
  beneficiaryRfc?: string;
  concept?: string;
};

export async function requestSpeiWithdrawal(input: RequestSpeiInput): Promise<Withdrawal> {
  const { account, amountCentavos: amount } = input;
  if (amount <= 0) throw new Error("Monto inválido.");
  if (amount > account.maxAmountPerOperation) {
    throw new Error("El monto excede el máximo por operación.");
  }

  const gEquiv = grossEquivalent(amount, account.commissionBps);
  const externalReference = `wd-${Date.now()}-${randomUUID().slice(0, 8)}`;

  return db.transaction(async (tx) => {
    // Reserva atómica: descuenta solo si hay saldo suficiente.
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
        type: "spei",
        status: "pending",
        externalReference,
        amount,
        grossEquivalent: gEquiv,
        requestedByUserId: input.requestedByUserId,
        beneficiaryAccount: input.beneficiaryAccount,
        beneficiaryName: input.beneficiaryName,
        beneficiaryRfc: input.beneficiaryRfc ?? null,
        concept: input.concept ?? "RETIRO",
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
          memo: "Reserva por retiro SPEI",
        },
        {
          account: "pending_withdrawals",
          amount,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "Retiro SPEI en proceso",
        },
      ],
    });

    return wd;
  });
}

/* ── Aprobación / rechazo (admin) ──────────────────────────────── */

export async function approveSpeiWithdrawal(input: {
  withdrawalId: string;
  adminUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, input.withdrawalId))
    .limit(1);
  if (!wd || wd.status !== "pending") return { ok: false, error: "El retiro no está pendiente." };

  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, wd.clientAccountId))
    .limit(1);
  if (!account) return { ok: false, error: "Cuenta no encontrada." };
  const [clientUser] = await db.select().from(users).where(eq(users.id, account.userId)).limit(1);

  // Despacho a NovaCore (monto ÍNTEGRO; la comisión del broker no se resta aquí).
  const core = coreClientFor(account);
  const res = await core.dispatchSpei({
    beneficiaryAccount: wd.beneficiaryAccount ?? "",
    beneficiaryName: wd.beneficiaryName ?? "",
    amount: centavosToPesos(wd.amount),
    concept: wd.concept ?? "RETIRO",
    externalReference: wd.externalReference,
    beneficiaryRfc: wd.beneficiaryRfc ?? "",
  });

  if (!res.success) {
    await db.transaction(async (tx) => {
      await tx
        .update(withdrawals)
        .set({
          status: "failed",
          reviewedByUserId: input.adminUserId,
          reviewedAt: new Date(),
          rejectionReason: res.error ?? "Dispatch falló",
          updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, wd.id));
      await refundReserve(tx, account, wd.amount, wd.id);
    });
    return { ok: false, error: res.error };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(withdrawals)
      .set({
        status: "sent",
        reviewedByUserId: input.adminUserId,
        reviewedAt: new Date(),
        novacoreTransactionId: res.transactionId ?? null,
        novacoreTrackingKey: res.trackingKey ?? null,
        novacoreStatus: res.status ?? "sent",
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, wd.id));

    // Acumula comisión del broker (gasto que sale del 4%).
    if (clientUser?.brokerId) {
      const bps = account.brokerSpeiBps;
      const commission = applyBps(wd.grossEquivalent, bps);
      if (commission > 0) {
        await tx.insert(brokerCommissions).values({
          brokerUserId: clientUser.brokerId,
          clientAccountId: account.id,
          withdrawalId: wd.id,
          type: "spei",
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
              memo: "Comisión broker SPEI",
            },
            {
              account: "platform_revenue",
              amount: -commission,
              clientAccountId: account.id,
              memo: "Comisión broker SPEI (gasto)",
            },
          ],
        });
      }
    }
  });

  return { ok: true };
}

export async function rejectWithdrawal(input: {
  withdrawalId: string;
  adminUserId: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.id, input.withdrawalId))
    .limit(1);
  if (!wd || wd.status !== "pending") return { ok: false, error: "El retiro no está pendiente." };

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
        reviewedByUserId: input.adminUserId,
        reviewedAt: new Date(),
        rejectionReason: input.reason ?? "Rechazado por admin",
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, wd.id));
    await refundReserve(tx, account, wd.amount, wd.id);
  });

  return { ok: true };
}

/* ── Finalización vía Webhook C ────────────────────────────────── */

const NOVACORE_TO_STATUS: Record<string, Withdrawal["status"]> = {
  scattered: "settled",
  returned: "returned",
  canceled: "canceled",
  failed: "failed",
  sent: "sent",
};

const TERMINAL: ReadonlySet<string> = new Set(["settled", "returned", "canceled", "failed", "rejected"]);

export async function finalizeWithdrawalByStatus(
  externalReference: string,
  novacoreStatus: string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.externalReference, externalReference))
    .limit(1);
  if (!wd) throw new Error("Retiro no encontrado.");

  const target = NOVACORE_TO_STATUS[novacoreStatus] ?? wd.status;
  // Idempotencia: si ya está en estado terminal, no reprocesar.
  if (TERMINAL.has(wd.status)) return { ok: true, skipped: true };

  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, wd.clientAccountId))
    .limit(1);
  if (!account) throw new Error("Cuenta no encontrada.");

  await db.transaction(async (tx) => {
    await tx
      .update(withdrawals)
      .set({ novacoreStatus, status: target, updatedAt: new Date() })
      .where(eq(withdrawals.id, wd.id));

    if (target === "settled") {
      // El dinero salió físicamente del core.
      await postLedger(tx, {
        refType: "withdrawal",
        refId: wd.id,
        entries: [
          {
            account: "pending_withdrawals",
            amount: -wd.amount,
            ownerUserId: account.userId,
            clientAccountId: account.id,
            memo: "Retiro liquidado",
          },
          {
            account: "core_cash",
            amount: -wd.amount,
            clientAccountId: account.id,
            memo: "Salida SPEI",
          },
        ],
      });
    } else if (target === "returned" || target === "canceled" || target === "failed") {
      await refundReserve(tx, account, wd.amount, wd.id);
      await reverseBrokerCommission(tx, account, wd);
    }
  });

  return { ok: true };
}
