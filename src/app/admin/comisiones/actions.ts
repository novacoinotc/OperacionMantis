"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { payBrokerPayout, rejectBrokerPayout } from "@/lib/services/payouts";

export async function payPayoutAction(payoutId: string, txHash: string) {
  const admin = await requireRole("admin");
  const res = await payBrokerPayout({
    payoutId,
    adminUserId: admin.id,
    txHash: txHash || undefined,
  });
  revalidatePath("/admin/comisiones");
  return res;
}

export async function rejectPayoutAction(payoutId: string) {
  const admin = await requireRole("admin");
  const res = await rejectBrokerPayout({ payoutId, adminUserId: admin.id });
  revalidatePath("/admin/comisiones");
  return res;
}
