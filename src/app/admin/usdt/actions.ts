"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { completeUsdtOrder, rejectUsdtOrder } from "@/lib/services/usdt";

export async function completeUsdtAction(withdrawalId: string, usdtTxHash: string) {
  const admin = await requireRole("admin");
  const res = await completeUsdtOrder({
    withdrawalId,
    adminUserId: admin.id,
    usdtTxHash: usdtTxHash || undefined,
  });
  revalidatePath("/admin/usdt");
  revalidatePath("/admin");
  return res;
}

export async function rejectUsdtAction(withdrawalId: string) {
  const admin = await requireRole("admin");
  const res = await rejectUsdtOrder({ withdrawalId, adminUserId: admin.id });
  revalidatePath("/admin/usdt");
  revalidatePath("/admin");
  return res;
}
