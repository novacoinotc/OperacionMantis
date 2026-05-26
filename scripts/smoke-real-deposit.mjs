import crypto from "node:crypto";

// Simula el Webhook A de NovaCore con la firma real (secret por env).
// Uso: MACAIBA_DEPOSIT_SECRET=... node scripts/smoke-real-deposit.mjs
const BASE = process.env.BASE ?? "https://www.opmantis.com";
const prefix = process.env.MACAIBA_API_PREFIX ?? "ncapi-a3";
const secret = process.env.MACAIBA_DEPOSIT_SECRET;
if (!secret) throw new Error("Falta MACAIBA_DEPOSIT_SECRET");

async function post(beneficiaryAccount, tag, amount = "10.00") {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({
    type: "deposit.received",
    trackingKey: `TEST-${tag}-${Date.now()}`,
    amount,
    currency: "MXN",
    beneficiaryAccount,
    payerAccount: "012180001234567890",
    payerName: "PRUEBA OPMANTIS",
    concept: "PRUEBA",
    receivedAt: new Date().toISOString(),
  });
  const sig =
    "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${nonce}.${body}`).digest("hex");
  const res = await fetch(`${BASE}/api/novacore/deposit-received`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Novacore-Timestamp": ts,
      "X-Novacore-Nonce": nonce,
      "X-Novacore-Signature": sig,
      "X-Novacore-ApiKey-Prefix": prefix,
    },
    body,
  });
  console.log(`[${tag}] ${beneficiaryAccount} → ${res.status}`, await res.text());
}

// CLABE monitoreada → debe acreditar
await post("684180327010000022", "monitoreada-0022");
// CLABE de salidas (no monitoreada) → debe ignorarse (skipped)
await post("684180327010000103", "salidas-0103");
// Firma inválida → debe rechazar 401
{
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ type: "deposit.received", trackingKey: "BAD", amount: "10.00", currency: "MXN", beneficiaryAccount: "684180327010000022" });
  const res = await fetch(`${BASE}/api/novacore/deposit-received`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Novacore-Timestamp": ts,
      "X-Novacore-Nonce": nonce,
      "X-Novacore-Signature": "sha256=deadbeef",
      "X-Novacore-ApiKey-Prefix": prefix,
    },
    body,
  });
  console.log(`[firma-invalida] → ${res.status}`, await res.text());
}
