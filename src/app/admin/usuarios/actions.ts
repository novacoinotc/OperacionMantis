"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { clientAccounts, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { encryptSecret } from "@/lib/crypto";
import { pesosToCentavos } from "@/lib/money";

export type FormState = { error?: string; success?: string } | null;

/* ── Crear broker ──────────────────────────────────────────────── */

const brokerSchema = z.object({
  name: z.string().min(2, "Nombre requerido."),
  email: z.string().email("Correo inválido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function createBrokerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = brokerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const email = parsed.data.email.toLowerCase();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return { error: "Ya existe un usuario con ese correo." };

  await db.insert(users).values({
    name: parsed.data.name,
    email,
    role: "broker",
    passwordHash: hashPassword(parsed.data.password),
  });

  revalidatePath("/admin/usuarios");
  return { success: `Broker ${email} creado.` };
}

/* ── Crear cliente + su cuenta NovaCore ────────────────────────── */

const clientSchema = z.object({
  name: z.string().min(2, "Nombre requerido."),
  email: z.string().email("Correo inválido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  brokerId: z.string().optional(),
  depositClabes: z
    .string()
    .transform((s) =>
      s
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().regex(/^\d{18}$/, "Cada CLABE de depósito debe tener 18 dígitos."))
        .min(1, "Agrega al menos una CLABE de depósito."),
    ),
  withdrawalClabe: z.string().regex(/^\d{18}$/, "La CLABE de salida debe tener 18 dígitos."),
  apiKeyPrefix: z.string().min(3, "El api_key_prefix (ej. ncapi-XX) es requerido."),
  apiKey: z.string().min(8, "API key inválida."),
  depositSecret: z.string().min(8, "deposit_callback_secret inválido."),
  webhookSecret: z.string().min(8, "webhook_secret inválido."),
  payerName: z.string().optional(),
  payerRfc: z.string().optional(),
  maxAmount: z.coerce.number().positive("Máximo por operación inválido."),
  commissionBps: z.coerce.number().int().min(0).max(10000),
  brokerSpeiBps: z.coerce.number().int().min(0).max(10000),
  brokerCryptoBps: z.coerce.number().int().min(0).max(10000),
  usdtMarkupCentavos: z.coerce.number().int().min(0),
});

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    brokerId: formData.get("brokerId"),
    depositClabes: formData.get("depositClabes") ?? "",
    withdrawalClabe: formData.get("withdrawalClabe"),
    apiKeyPrefix: formData.get("apiKeyPrefix"),
    apiKey: formData.get("apiKey"),
    depositSecret: formData.get("depositSecret"),
    webhookSecret: formData.get("webhookSecret"),
    payerName: formData.get("payerName"),
    payerRfc: formData.get("payerRfc"),
    maxAmount: formData.get("maxAmount"),
    commissionBps: formData.get("commissionBps"),
    brokerSpeiBps: formData.get("brokerSpeiBps"),
    brokerCryptoBps: formData.get("brokerCryptoBps"),
    usdtMarkupCentavos: formData.get("usdtMarkupCentavos"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const d = parsed.data;
  const email = d.email.toLowerCase();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists) return { error: "Ya existe un usuario con ese correo." };

  try {
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          name: d.name,
          email,
          role: "user",
          passwordHash: hashPassword(d.password),
          brokerId: d.brokerId && d.brokerId.length > 0 ? d.brokerId : null,
        })
        .returning({ id: users.id });

      await tx.insert(clientAccounts).values({
        userId: u.id,
        label: d.name,
        novacoreApiKeyPrefix: d.apiKeyPrefix,
        novacoreClabe: d.withdrawalClabe,
        depositClabes: d.depositClabes,
        encApiKey: encryptSecret(d.apiKey),
        encDepositSecret: encryptSecret(d.depositSecret),
        encWebhookSecret: encryptSecret(d.webhookSecret),
        payerName: d.payerName || null,
        payerRfc: d.payerRfc || null,
        maxAmountPerOperation: pesosToCentavos(d.maxAmount),
        commissionBps: d.commissionBps,
        brokerSpeiBps: d.brokerSpeiBps,
        brokerCryptoBps: d.brokerCryptoBps,
        usdtMarkupCentavos: d.usdtMarkupCentavos,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el cliente." };
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/cuentas");
  return { success: `Cliente ${email} creado con su cuenta NovaCore.` };
}
