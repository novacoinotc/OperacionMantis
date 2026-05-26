import crypto from "node:crypto";

// Simula el Webhook A de NovaCore con una firma HMAC válida (usa el secret mock sembrado).
const BASE = process.env.BASE ?? "http://localhost:3100";
const secret = "mock-deposit-secret";
const prefix = "MOCK1234";
const ts = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomUUID();

const body = JSON.stringify({
  type: "deposit.received",
  trackingKey: `SMOKE-${Date.now()}`,
  amount: "1000000.00",
  currency: "MXN",
  beneficiaryAccount: "684180327002001314",
  payerAccount: "012180001234567890",
  payerName: "JUAN PEREZ GOMEZ",
  concept: "PAGO",
  receivedAt: new Date().toISOString(),
});

const sig =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(`${ts}.${nonce}.${body}`).digest("hex");

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

console.log("POST /api/novacore/deposit-received →", res.status);
console.log(await res.text());

// Reenvío idéntico para probar idempotencia (mismo trackingKey, nuevo nonce/firma).
const nonce2 = crypto.randomUUID();
const sig2 =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(`${ts}.${nonce2}.${body}`).digest("hex");
const res2 = await fetch(`${BASE}/api/novacore/deposit-received`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Novacore-Timestamp": ts,
    "X-Novacore-Nonce": nonce2,
    "X-Novacore-Signature": sig2,
    "X-Novacore-ApiKey-Prefix": prefix,
  },
  body,
});
console.log("Reenvío (idempotencia) →", res2.status, await res2.text());
