"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId } from "@/lib/queries";
import { createUsdtOrder } from "@/lib/services/usdt";
import { pesosToCentavos } from "@/lib/money";

const schema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a cero."),
  usdtAddress: z.string().min(20, "Dirección USDT inválida."),
  usdtNetwork: z.string().default("TRC20"),
});

export type UsdtState = { error?: string; success?: string } | null;

export async function createUsdtAction(_prev: UsdtState, formData: FormData): Promise<UsdtState> {
  const user = await requireRole("user");
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    usdtAddress: formData.get("usdtAddress"),
    usdtNetwork: formData.get("usdtNetwork") ?? "TRC20",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const account = await getClientAccountByUserId(user.id);
  if (!account) return { error: "Tu cuenta no está configurada." };

  try {
    await createUsdtOrder({
      account,
      requestedByUserId: user.id,
      amountCentavos: pesosToCentavos(parsed.data.amount),
      usdtAddress: parsed.data.usdtAddress,
      usdtNetwork: parsed.data.usdtNetwork,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la orden." };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/movimientos");
  return { success: "Orden de conversión creada. Se procesará manualmente." };
}
