import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { brokerCommissions, brokerPayouts } from "@/db/schema";
import { postLedger } from "@/lib/ledger";

export async function getBrokerAccrued(brokerUserId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${brokerCommissions.amount}),0)::bigint`,
    })
    .from(brokerCommissions)
    .where(
      and(eq(brokerCommissions.brokerUserId, brokerUserId), eq(brokerCommissions.status, "accrued")),
    );
  return Number(row?.total ?? 0);
}

export async function getPendingPayout(brokerUserId: string) {
  const [p] = await db
    .select()
    .from(brokerPayouts)
    .where(and(eq(brokerPayouts.brokerUserId, brokerUserId), eq(brokerPayouts.status, "pending")))
    .limit(1);
  return p ?? null;
}

export type RequestPayoutInput = {
  brokerUserId: string;
  method: "spei" | "crypto";
  destinationClabe?: string;
  destinationName?: string;
  destinationAddress?: string;
  destinationNetwork?: string;
};

export async function requestBrokerPayout(input: RequestPayoutInput) {
  const accrued = await getBrokerAccrued(input.brokerUserId);
  if (accrued <= 0) throw new Error("No tienes comisiones por cobrar.");
  if (await getPendingPayout(input.brokerUserId)) {
    throw new Error("Ya tienes una solicitud de cobro pendiente.");
  }

  const [payout] = await db
    .insert(brokerPayouts)
    .values({
      brokerUserId: input.brokerUserId,
      method: input.method,
      amount: accrued,
      destinationClabe: input.destinationClabe ?? null,
      destinationName: input.destinationName ?? null,
      destinationAddress: input.destinationAddress ?? null,
      destinationNetwork: input.destinationNetwork ?? null,
    })
    .returning();
  return payout;
}

export async function payBrokerPayout(input: {
  payoutId: string;
  adminUserId: string;
  txHash?: string;
  reference?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [payout] = await db
    .select()
    .from(brokerPayouts)
    .where(eq(brokerPayouts.id, input.payoutId))
    .limit(1);
  if (!payout || payout.status !== "pending") return { ok: false, error: "Cobro no procesable." };

  await db.transaction(async (tx) => {
    await tx
      .update(brokerPayouts)
      .set({
        status: "paid",
        processedByUserId: input.adminUserId,
        processedAt: new Date(),
        txHash: input.txHash ?? null,
        reference: input.reference ?? null,
      })
      .where(eq(brokerPayouts.id, payout.id));

    // Marca como pagadas las comisiones acumuladas hasta la fecha del cobro.
    await tx
      .update(brokerCommissions)
      .set({ status: "paid", paidAt: new Date() })
      .where(
        and(
          eq(brokerCommissions.brokerUserId, payout.brokerUserId),
          eq(brokerCommissions.status, "accrued"),
          lte(brokerCommissions.createdAt, payout.createdAt),
        ),
      );

    // Ledger: liquida el pasivo con el broker (sale del efectivo del pool).
    await postLedger(tx, {
      refType: "commission",
      refId: payout.id,
      entries: [
        {
          account: "broker_payable",
          amount: -payout.amount,
          ownerUserId: payout.brokerUserId,
          memo: "Pago de comisiones al broker",
        },
        {
          account: "core_cash",
          amount: -payout.amount,
          memo: "Salida pago a broker",
        },
      ],
    });
  });

  return { ok: true };
}

export async function rejectBrokerPayout(input: {
  payoutId: string;
  adminUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [payout] = await db
    .select()
    .from(brokerPayouts)
    .where(eq(brokerPayouts.id, input.payoutId))
    .limit(1);
  if (!payout || payout.status !== "pending") return { ok: false, error: "Cobro no procesable." };

  await db
    .update(brokerPayouts)
    .set({ status: "rejected", processedByUserId: input.adminUserId, processedAt: new Date() })
    .where(eq(brokerPayouts.id, payout.id));
  return { ok: true };
}
