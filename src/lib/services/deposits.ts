import { db } from "@/db";
import { deposits, type ClientAccount } from "@/db/schema";
import { splitDeposit, pesosToCentavos } from "@/lib/money";
import { bumpAvailableBalance, postLedger } from "@/lib/ledger";

export type CreditDepositInput = {
  account: ClientAccount;
  trackingKey: string;
  grossPesos: string | number;
  payerName?: string;
  payerAccount?: string;
  beneficiaryAccount?: string;
  concept?: string;
  receivedAt?: string | null;
  source?: "webhook" | "reconciliation";
  raw?: unknown;
};

export type CreditDepositResult = {
  created: boolean; // false = era duplicado (idempotente)
  depositId?: string;
  gross?: number;
  commission?: number;
  net?: number;
};

/**
 * Acredita un depósito: parte el bruto en 4% + neto, registra el depósito de
 * forma idempotente (por trackingKey) y postea el ledger. Todo en una sola
 * transacción. Si el trackingKey ya existía, no hace nada (idempotente).
 */
export async function creditDeposit(input: CreditDepositInput): Promise<CreditDepositResult> {
  const { account } = input;
  const gross = pesosToCentavos(input.grossPesos);
  if (gross <= 0) throw new Error("Monto de depósito inválido.");

  const commissionBps = account.commissionBps;
  const { commission, net } = splitDeposit(gross, commissionBps);

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(deposits)
      .values({
        clientAccountId: account.id,
        trackingKey: input.trackingKey,
        grossAmount: gross,
        commissionAmount: commission,
        netAmount: net,
        commissionBps,
        currency: "MXN",
        payerName: input.payerName ?? null,
        payerAccount: input.payerAccount ?? null,
        beneficiaryAccount: input.beneficiaryAccount ?? null,
        concept: input.concept ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
        source: input.source ?? "webhook",
        rawPayload: input.raw ?? null,
      })
      .onConflictDoNothing({ target: deposits.trackingKey })
      .returning({ id: deposits.id });

    // Duplicado → idempotente, no re-acreditar.
    if (inserted.length === 0) return { created: false };

    const depositId = inserted[0].id;

    await postLedger(tx, {
      refType: "deposit",
      refId: depositId,
      entries: [
        {
          account: "core_cash",
          amount: gross,
          clientAccountId: account.id,
          memo: "Depósito SPEI (bruto)",
        },
        {
          account: "client_available",
          amount: net,
          ownerUserId: account.userId,
          clientAccountId: account.id,
          memo: "Neto disponible al cliente",
        },
        {
          account: "platform_revenue",
          amount: commission,
          clientAccountId: account.id,
          memo: `Comisión plataforma (${(commissionBps / 100).toFixed(2)}%)`,
        },
      ],
    });

    await bumpAvailableBalance(tx, account.id, net);

    return { created: true, depositId, gross, commission, net };
  });
}
