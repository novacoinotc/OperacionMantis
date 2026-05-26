"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getClientAccountByUserId } from "@/lib/queries";
import { requestSpeiWithdrawal } from "@/lib/services/withdrawals";
import { pesosToCentavos } from "@/lib/money";

const schema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a cero."),
  beneficiaryAccount: z
    .string()
    .regex(/^(\d{16}|\d{18})$/, "Debe ser CLABE (18 dígitos) o tarjeta (16 dígitos)."),
  beneficiaryName: z.string().min(2, "Nombre del beneficiario requerido."),
  beneficiaryRfc: z.string().optional(),
  concept: z.string().optional(),
});

export type RetiroState = { error?: string; success?: string } | null;

export async function requestSpeiAction(
  _prev: RetiroState,
  formData: FormData,
): Promise<RetiroState> {
  const user = await requireRole("user");
  const parsed = schema.safeParse({
    amount: formData.get("amount"),
    beneficiaryAccount: formData.get("beneficiaryAccount"),
    beneficiaryName: formData.get("beneficiaryName"),
    beneficiaryRfc: formData.get("beneficiaryRfc"),
    concept: formData.get("concept"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const account = await getClientAccountByUserId(user.id);
  if (!account) return { error: "Tu cuenta no está configurada." };

  try {
    await requestSpeiWithdrawal({
      account,
      requestedByUserId: user.id,
      amountCentavos: pesosToCentavos(parsed.data.amount),
      beneficiaryAccount: parsed.data.beneficiaryAccount,
      beneficiaryName: parsed.data.beneficiaryName,
      beneficiaryRfc: parsed.data.beneficiaryRfc || undefined,
      concept: parsed.data.concept || undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el retiro." };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/movimientos");
  return { success: "Solicitud creada. Queda pendiente de aprobación del administrador." };
}
