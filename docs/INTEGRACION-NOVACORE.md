# Integración con NovaCore (core bancario)

NovaCore es el banking core (Next.js + Postgres/RDS) conectado a **OPM** como participante
indirecto SPEI. Expone 2 endpoints REST + 2 webhooks salientes. Este dashboard es un
consumidor externo multi-tenant: **cada cliente del dashboard = un `integration_api_key`**
en NovaCore.

## Credenciales por cliente (las provisiona el admin de NovaCore)

Por cada cliente nuevo, el admin de NovaCore crea un `integration_api_key` y nos entrega
**una sola vez**:

| Dato | Uso en el dashboard |
|------|---------------------|
| `api_key` (plaintext) | Header `X-API-Key` en llamadas salientes (dispatch, reconciliación) |
| CLABE asignada (`clabe_account_id`) | Wallet del cliente; de aquí salen sus retiros. NovaCore la conoce por la API key — **no se manda** en el dispatch |
| `webhook_secret` | Verificar HMAC del **Webhook C** (status de retiro) |
| `deposit_callback_secret` | Verificar HMAC del **Webhook A** (depósito recibido) |
| `payer_name` / `payer_uid` | Nombre/RFC que sale en el CEP del retiro |
| `max_amount_per_operation` | Tope por operación (default $50,000 MXN) |

Estos secretos se guardan **cifrados (AES-256-GCM)** en nuestra DB. Nunca en texto plano ni en logs.

URLs que nosotros exponemos y se registran en NovaCore:
- `deposit_callback_url` → `https://<dashboard>/api/novacore/deposit-received`
- `webhook_url` → `https://<dashboard>/api/novacore/withdrawal-status`

---

## Webhook A — Depósito recibido  (NovaCore → dashboard)

`POST {deposit_callback_url}`  ·  `Content-Type: application/json`

**Headers:**
- `X-Novacore-Timestamp`: epoch en segundos
- `X-Novacore-Nonce`: uuid v4 (anti-replay)
- `X-Novacore-Signature`: `sha256=<hex>`
- `X-Novacore-ApiKey-Prefix`: 8 chars → identifica el tenant

**Body:**
```json
{
  "type": "deposit.received",
  "trackingKey": "058-15/05/2026/XXXXXXX",
  "amount": "1000000.00",
  "currency": "MXN",
  "beneficiaryAccount": "684180327002001314",
  "payerAccount": "012180001234567890",
  "payerName": "JUAN PEREZ GOMEZ",
  "concept": "PAGO",
  "receivedAt": "2026-05-26T15:30:00.000Z"
}
```

**Verificación de firma** (formato EXACTO `timestamp.nonce.rawBody`):
```ts
const expected = crypto.createHmac('sha256', depositCallbackSecret)
  .update(`${timestamp}.${nonce}.${rawBody}`)
  .digest('hex');
// timingSafeEqual(`sha256=${expected}`, header)
// rechazar si: |now - timestamp| > 300s  |  nonce ya visto  |  firma no coincide
```

- **Idempotencia:** `trackingKey` con UNIQUE constraint. Reenvío → se ignora.
- **NovaCore NO reintenta** (fire-and-forget, timeout 10s). Si fallamos, el evento se pierde
  → por eso existe la reconciliación (Endpoint D).

---

## Endpoint B — Ordenar SPEI saliente  (dashboard → NovaCore)

`POST https://novacore.<dominio>/api/integrations/spei-dispatch`
`X-API-Key: <plaintext>`

**Body:**
```json
{
  "beneficiaryAccount": "012180001234567890",
  "beneficiaryName": "MARIA LOPEZ HERNANDEZ",
  "amount": 50000.00,
  "concept": "RETIRO",
  "externalReference": "wd-2026-05-26-001",
  "beneficiaryRfc": ""
}
```

- `beneficiaryAccount`: CLABE 18 díg o tarjeta 16 díg (bank code lo infiere NovaCore).
- `externalReference`: **llave de idempotencia** de nuestro lado. Mismo ref + misma key → no crea retiro nuevo, devuelve el existente.
- `amount` ≤ `max_amount_per_operation`.
- CLABE origen fija en la API key (no se manda).
- NovaCore valida saldo en transacción atómica → `"Saldo insuficiente"`.
- **Importante (decisión nuestra):** `amount` = monto íntegro que pide el cliente de su saldo NETO. La comisión del broker NO se descuenta aquí.
- Rate limit: **30 req/min/API key**.

**OK:** `{ "success": true, "transactionId": "tx_api_<uuid>", "trackingKey": "...", "status": "sent" }`
**Error:** `{ "success": false, "error": "Saldo insuficiente" }`

---

## Webhook C — Status final del retiro  (NovaCore → dashboard)

`POST {webhook_url}`

**Header:** `X-Novacore-Signature: <hex>` → HMAC-SHA256(secret, rawBody) **plano, SIN prefijo
`sha256=` y SIN timestamp/nonce** (distinto al Webhook A).

**Body:**
```json
{ "trackingKey": "...", "externalReference": "wd-2026-05-26-001", "status": "scattered", "timestamp": "2026-05-26T15:31:02.000Z" }
```

**Estados:**
- `scattered` → liquidado OK
- `returned` → banco destino rechazó → **reembolsar saldo** al cliente
- `canceled` → OPM canceló antes de enviar → no descontó saldo
- `failed` → falló validación local → no descontó saldo

**Verificación:** `crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')` == header (timingSafeEqual).

---

## Endpoint D — Reconciliación de depósitos  (dashboard → NovaCore)

Cron cada 5 min para no perder depósitos (Webhook A no reintenta).

`GET https://novacore.<dominio>/api/integrations/spei-deposits?since=<ISO8601>&status=completed&limit=100`
`X-API-Key: <plaintext>`

Query: `since` (REQUERIDO, máx 7 días atrás), `until` (default now), `status`
(`completed|returned|all`, default completed), `limit` (default 100, máx 500), `cursor` (base64).

**Respuesta:** `{ "deposits": [ { trackingKey, amount, currency, beneficiaryAccount, payerAccount, payerName, concept, status, settledAt, createdAt } ], "nextCursor": "..." }`

Scope-ado al `company_id` de la API key (sin leakage entre tenants).

---

## Lo que NovaCore maneja (no es nuestra responsabilidad)
Firma RSA a OPM · catálogo de bancos/clave SPEI (lo infiere del CLABE) · tracking key del SPEI
saliente · conciliación con OPM · CEP (lo expone vía `getOrderCep` si lo queremos incrustar).

## Decisiones ya tomadas (sobre las preguntas del handoff)
1. **4% se aplica al depósito** (no al retiro). El cliente ve neto desde el inicio.
2. **Broker 1.5% SPEI / 1.2% crypto sobre el bruto-equivalente**, sale del 4% nuestro (accrual interno, NO se resta al dispatch).
3. **Broker** ve movimientos de sus clientes + su comisión; NO ve bruto ni el 4%.
4. Usaremos **webhook + reconciliación (poll 5 min)** como red de seguridad.
