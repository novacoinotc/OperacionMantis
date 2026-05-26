"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { approveSpeiWithdrawal, rejectWithdrawal } from "@/lib/services/withdrawals";

export async function approveWithdrawalAction(withdrawalId: string) {
  const admin = await requireRole("admin");
  const res = await approveSpeiWithdrawal({ withdrawalId, adminUserId: admin.id });
  revalidatePath("/admin/retiros");
  revalidatePath("/admin");
  return res;
}

export async function rejectWithdrawalAction(withdrawalId: string) {
  const admin = await requireRole("admin");
  const res = await rejectWithdrawal({ withdrawalId, adminUserId: admin.id });
  revalidatePath("/admin/retiros");
  revalidatePath("/admin");
  return res;
}
