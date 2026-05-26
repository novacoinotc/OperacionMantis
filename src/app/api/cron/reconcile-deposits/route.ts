import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientAccounts } from "@/db/schema";
import { coreClientFor } from "@/lib/novacore";
import { creditDeposit } from "@/lib/services/deposits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint D — Reconciliación de depósitos. Cron cada 5 min: por cada cuenta
 * consulta a NovaCore los depósitos recientes y acredita los que falten
 * (idempotente por trackingKey). Red de seguridad porque el Webhook A no reintenta.
 * Protegido por CRON_SECRET (Vercel Cron manda Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const accounts = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.isActive, true));

  const since = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // últimos 30 min
  let scanned = 0;
  let credited = 0;

  for (const account of accounts) {
    if (!account.encApiKey) continue;
    try {
      const core = coreClientFor(account);
      const page = await core.listDeposits({ since, status: "completed", limit: 100 });
      for (const d of page.deposits) {
        scanned++;
        const res = await creditDeposit({
          account,
          trackingKey: d.trackingKey,
          grossPesos: d.amount,
          payerName: d.payerName,
          payerAccount: d.payerAccount,
          beneficiaryAccount: d.beneficiaryAccount,
          concept: d.concept,
          receivedAt: d.settledAt ?? d.createdAt ?? null,
          source: "reconciliation",
          raw: d,
        });
        if (res.created) credited++;
      }
    } catch (err) {
      console.error("Reconciliación falló para cuenta", account.id, err);
    }
  }

  return NextResponse.json({ ok: true, accounts: accounts.length, scanned, credited });
}
