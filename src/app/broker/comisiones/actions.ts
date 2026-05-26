"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { requestBrokerPayout } from "@/lib/services/payouts";

const schema = z
  .object({
    method: z.enum(["spei", "crypto"]),
    destinationClabe: z.string().optional(),
    destinationName: z.string().optional(),
    destinationAddress: z.string().optional(),
    destinationNetwork: z.string().optional(),
  })
  .refine(
    (d) =>
      d.method === "spei"
        ? /^\d{18}$/.test(d.destinationClabe ?? "") && (d.destinationName ?? "").length > 1
        : (d.destinationAddress ?? "").length > 10,
    { message: "Completa los datos del destino (CLABE+nombre o dirección)." },
  );

export type PayoutState = { error?: string; success?: string } | null;

export async function requestPayoutAction(
  _prev: PayoutState,
  formData: FormData,
): Promise<PayoutState> {
  const broker = await requireRole("broker");
  const parsed = schema.safeParse({
    method: formData.get("method"),
    destinationClabe: formData.get("destinationClabe") || undefined,
    destinationName: formData.get("destinationName") || undefined,
    destinationAddress: formData.get("destinationAddress") || undefined,
    destinationNetwork: formData.get("destinationNetwork") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    await requestBrokerPayout({ brokerUserId: broker.id, ...parsed.data });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo solicitar el cobro." };
  }

  revalidatePath("/broker/comisiones");
  revalidatePath("/broker");
  return { success: "Solicitud de cobro enviada. El admin la procesará." };
}
