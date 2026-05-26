import { decryptSecret } from "@/lib/crypto";
import type { ClientAccount } from "@/db/schema";
import { getCoreClient, type CoreClient } from "./client";

/** Base URL del core (global). */
export function coreBaseUrl(): string {
  return process.env.NOVACORE_BASE_URL ?? "";
}

/** Cliente del core configurado con las credenciales (desencriptadas) del tenant. */
export function coreClientFor(account: Pick<ClientAccount, "encApiKey">): CoreClient {
  const apiKey = account.encApiKey ? decryptSecret(account.encApiKey) : "";
  return getCoreClient({ baseUrl: coreBaseUrl(), apiKey });
}

/** Secret para verificar el webhook A (depósito). */
export function depositSecretFor(account: Pick<ClientAccount, "encDepositSecret">): string {
  if (!account.encDepositSecret) throw new Error("Cuenta sin deposit secret configurado.");
  return decryptSecret(account.encDepositSecret);
}

/** Secret para verificar el webhook C (status de retiro). */
export function withdrawalSecretFor(account: Pick<ClientAccount, "encWebhookSecret">): string {
  if (!account.encWebhookSecret) throw new Error("Cuenta sin webhook secret configurado.");
  return decryptSecret(account.encWebhookSecret);
}

export * from "./types";
export * from "./signatures";
export { getCoreClient } from "./client";
export type { CoreClient, CoreCreds } from "./client";
