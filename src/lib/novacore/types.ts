import { z } from "zod";

/* Payload del Webhook A — depósito recibido (NovaCore → dashboard). */
export const depositWebhookSchema = z.object({
  type: z.literal("deposit.received"),
  trackingKey: z.string().min(1),
  amount: z.string().min(1), // "1000000.00" (pesos)
  currency: z.string().default("MXN"),
  beneficiaryAccount: z.string().min(1),
  payerAccount: z.string().optional().default(""),
  payerName: z.string().optional().default(""),
  concept: z.string().optional().default(""),
  receivedAt: z.string().optional(),
});
export type DepositWebhookPayload = z.infer<typeof depositWebhookSchema>;

/* Payload del Webhook C — status final del retiro (NovaCore → dashboard). */
export const withdrawalStatusSchema = z.object({
  trackingKey: z.string().min(1),
  externalReference: z.string().min(1),
  status: z.enum(["scattered", "returned", "canceled", "failed", "sent"]),
  timestamp: z.string().optional(),
});
export type WithdrawalStatusPayload = z.infer<typeof withdrawalStatusSchema>;

/* Endpoint B — orden de SPEI saliente (dashboard → NovaCore). amount en PESOS. */
export type SpeiDispatchRequest = {
  beneficiaryAccount: string;
  beneficiaryName: string;
  amount: number; // pesos (ej. 50000.00)
  concept: string;
  externalReference: string;
  beneficiaryRfc?: string;
};

export type SpeiDispatchResult = {
  success: boolean;
  transactionId?: string;
  trackingKey?: string;
  status?: string;
  error?: string;
};

/* Endpoint D — reconciliación de depósitos. */
export type ReconcileParams = {
  since: string; // ISO8601 (máx 7 días atrás)
  until?: string;
  status?: "completed" | "returned" | "all";
  limit?: number;
  cursor?: string;
};

export type ReconcileDeposit = {
  trackingKey: string;
  amount: string;
  currency: string;
  beneficiaryAccount: string;
  payerAccount?: string;
  payerName?: string;
  concept?: string;
  status: string;
  settledAt?: string;
  createdAt?: string;
};

export type ReconcilePage = {
  deposits: ReconcileDeposit[];
  nextCursor?: string | null;
};
