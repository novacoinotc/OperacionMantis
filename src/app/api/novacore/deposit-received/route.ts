import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientAccounts, webhookNonces } from "@/db/schema";
import { depositSecretFor, depositWebhookSchema, verifyDepositSignature } from "@/lib/novacore";
import { creditDeposit } from "@/lib/services/deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook A — Depósito recibido (NovaCore → dashboard).
 * Flujo: localizar tenant → verificar HMAC (ts.nonce.body) + ventana ±5min →
 * anti-replay por nonce → parsear → acreditar (idempotente por trackingKey).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const timestamp = req.headers.get("x-novacore-timestamp") ?? "";
  const nonce = req.headers.get("x-novacore-nonce") ?? "";
  const signature = req.headers.get("x-novacore-signature") ?? "";
  const prefix = req.headers.get("x-novacore-apikey-prefix") ?? "";

  if (!timestamp || !nonce || !signature || !prefix) {
    return NextResponse.json({ error: "Headers de firma faltantes" }, { status: 400 });
  }

  // Localizar el tenant por el prefijo de su API key.
  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.novacoreApiKeyPrefix, prefix))
    .limit(1);

  if (!account || !account.isActive) {
    return NextResponse.json({ error: "Tenant desconocido o inactivo" }, { status: 404 });
  }

  // Verificar firma ANTES de parsear o tocar la DB con el contenido.
  let secret: string;
  try {
    secret = depositSecretFor(account);
  } catch {
    return NextResponse.json({ error: "Tenant sin secret configurado" }, { status: 500 });
  }

  const sig = verifyDepositSignature({
    secret,
    timestamp,
    nonce,
    rawBody,
    signatureHeader: signature,
  });
  if (!sig.ok) {
    return NextResponse.json({ error: sig.reason ?? "Firma inválida" }, { status: 401 });
  }

  // Anti-replay: el nonce solo puede usarse una vez.
  const nonceRow = await db
    .insert(webhookNonces)
    .values({ nonce })
    .onConflictDoNothing({ target: webhookNonces.nonce })
    .returning({ nonce: webhookNonces.nonce });
  if (nonceRow.length === 0) {
    return NextResponse.json({ error: "Nonce repetido (replay)" }, { status: 409 });
  }

  // Parsear y validar el payload.
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }
  const parsed = depositWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const p = parsed.data;

  // La CLABE beneficiaria debe ser la del tenant.
  if (account.novacoreClabe && p.beneficiaryAccount !== account.novacoreClabe) {
    return NextResponse.json({ error: "CLABE beneficiaria no coincide" }, { status: 409 });
  }

  try {
    const result = await creditDeposit({
      account,
      trackingKey: p.trackingKey,
      grossPesos: p.amount,
      payerName: p.payerName,
      payerAccount: p.payerAccount,
      beneficiaryAccount: p.beneficiaryAccount,
      concept: p.concept,
      receivedAt: p.receivedAt ?? null,
      source: "webhook",
      raw: p,
    });
    return NextResponse.json({ ok: true, created: result.created });
  } catch (err) {
    console.error("Error acreditando depósito:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
