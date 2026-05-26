import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientAccounts, withdrawals } from "@/db/schema";
import {
  verifyWithdrawalSignature,
  withdrawalSecretFor,
  withdrawalStatusSchema,
} from "@/lib/novacore";
import { finalizeWithdrawalByStatus } from "@/lib/services/withdrawals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook C — Status final del retiro (NovaCore → dashboard).
 * Como no trae prefijo de tenant, localizamos la cuenta por externalReference
 * (único) para obtener su secret, y luego verificamos el HMAC plano del body.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-novacore-signature") ?? "";
  if (!signature) {
    return NextResponse.json({ error: "Firma faltante" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }
  const parsed = withdrawalStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const { externalReference, status } = parsed.data;

  const [wd] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.externalReference, externalReference))
    .limit(1);
  if (!wd) {
    return NextResponse.json({ error: "Retiro desconocido" }, { status: 404 });
  }

  const [account] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, wd.clientAccountId))
    .limit(1);
  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let secret: string;
  try {
    secret = withdrawalSecretFor(account);
  } catch {
    return NextResponse.json({ error: "Cuenta sin secret" }, { status: 500 });
  }

  if (!verifyWithdrawalSignature({ secret, rawBody, signatureHeader: signature })) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  try {
    const result = await finalizeWithdrawalByStatus(externalReference, status);
    return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
  } catch (err) {
    console.error("Error finalizando retiro:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
