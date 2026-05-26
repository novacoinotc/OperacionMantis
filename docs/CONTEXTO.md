# Operación Mantis — Contexto y progreso

Dashboard de **tesorería** para automatizar el flujo de un cliente que deposita MXN vía
SPEI al core bancario (NovaCore) y pide retornos por SPEI o conversión a USDT, menos comisión.

## Reglas de negocio (críticas)

- **Comisión plataforma: 4% oculto** sobre cada depósito bruto. El cliente SOLO ve su
  "saldo disponible" neto (`bruto × 0.96`). Nunca debe ver el 4% ni poder deducir el bruto.
  - Ej: depósito $1,000,000 → comisión $40,000 → disponible **$960,000**.
- **Comisión del broker: 1.5% en retiros SPEI, 1.2% en retiros crypto**, calculada sobre el
  **bruto-equivalente** del retiro (`neto ÷ 0.96`). Es gasto interno que **sale del 4%** de la
  plataforma; NO se le resta al monto que recibe el cliente, y el broker NO ve el 4% del cliente.
- **USDT**: se toma el precio MXN/USDT del **ticker público de Bitso** + **5 centavos** de spread.
  Sin conexión directa a Bitso. El retiro crypto se **procesa manual** por el admin.
- **Retiros SPEI**: requieren **aprobación del admin** antes de despachar el SPEI por API.
- El 4% se aplica **al depósito** (el cliente ve el neto desde el inicio).

## Roles y visibilidad

| Rol | Ve bruto | Ve 4% | Ve comisión broker | Saldo |
|-----|:---:|:---:|:---:|---|
| **Admin** | ✅ | ✅ | ✅ | todo + márgenes + conciliación |
| **Broker** | ❌ | ❌ | ✅ (la suya) | neto de sus clientes |
| **Cliente** | ❌ | ❌ | ❌ | solo su saldo disponible neto |

Jerarquía: `broker → clientes` (vía `users.broker_id`).

## Core bancario: NovaCore

Core (Next.js + Postgres) sobre **OPM** (SPEI indirecto). Cada cliente del dashboard = un
`integration_api_key` en NovaCore. Contrato completo en **`docs/INTEGRACION-NOVACORE.md`**:
- **Webhook A** (depósito): HMAC `sha256=hmac(secret, "ts.nonce.body")`, ventana ±5min, anti-replay por nonce, idempotencia por `trackingKey`. NovaCore NO reintenta.
- **Endpoint B** (`/api/integrations/spei-dispatch`): `X-API-Key`, `externalReference` = idempotencia. Despachamos el **monto íntegro** del cliente (la comisión del broker NO se resta aquí).
- **Webhook C** (status retiro): HMAC plano `hmac(secret, body)`. Estados: `scattered`(liquidado), `returned`(reembolsar), `canceled`/`failed`(sin descuento).
- **Endpoint D** (reconciliación): GET depósitos, cron cada 5 min como red de seguridad.

Todo detrás de `src/lib/novacore/` (`CoreClient` real + mock). `USE_MOCK_CORE=1` en dev.

## Modelo de dinero / ledger

- **Todo en enteros**: MXN en centavos, USDT en micro-USDT (1e6). Aritmética con BigInt (`src/lib/money.ts`).
- **Ledger de doble entrada** (`ledger_entries`, delta con signo por bucket). Cuentas:
  `core_cash`, `client_available`, `platform_revenue`, `broker_payable`, `usdt_payable`, `pending_withdrawals`.
- Eventos (ver `src/lib/ledger.ts`):
  - Depósito (G/C/N): `core_cash +G`, `client_available +N`, `platform_revenue +C`.
  - Reserva de retiro: `client_available -X`, `pending_withdrawals +X`.
  - SPEI liquidado: `pending_withdrawals -X`, `core_cash -X`.
  - SPEI devuelto/cancelado: `pending_withdrawals -X`, `client_available +X` (reembolso).
  - Comisión broker: `broker_payable +b`, `platform_revenue -b`.
  - USDT (reserva): `client_available -X`, `usdt_payable +X`. Al pagar manual: `usdt_payable -X`, `platform_revenue +X`.
- `client_accounts.available_balance` es un cache (fuente de verdad = ledger), actualizado en la misma transacción.

## Stack e infraestructura

- Next.js 16.2.6 (App Router, Turbopack), React 19.2, Tailwind v4, **shadcn** (Base UI, estilo base-nova), `motion` v12, tema **dark "web3"** (violeta/índigo) forzado.
- **Drizzle 0.45** + `@neondatabase/serverless` con `ws` (WebSocket en Node). Fuentes **`geist`** locales.
- **Auth propio**: email+password (scrypt) + sesión **JWT (`jose`)** en cookie httpOnly. `src/proxy.ts` protege rutas; `requireUser`/`requireRole` por rol.
- **GitHub**: https://github.com/novacoinotc/OperacionMantis (`main`). **Vercel**: `issac-villarruels-projects/operacion-mantis`. **DB**: Neon conectada a Vercel.
- Secretos de NovaCore cifrados con **AES-256-GCM** (`src/lib/crypto.ts`, `ENCRYPTION_KEY`).
- Layout de dashboards: **top nav + tarjetas**.

### Comandos
`pnpm dev | build | typecheck | db:generate | db:migrate | db:push | db:studio | db:seed`

### Usuarios seed (cambiar en prod)
- admin `direccion@novacoin.mx` / `Mantis#2026`
- broker `broker@demo.mx` / `Broker#2026`
- cliente `cliente@demo.mx` / `Cliente#2026` (tiene saldo demo de una prueba)

## Estado — TODAS las fases completas ✅

- ✅ Fase 1 Scaffold + tema dark
- ✅ Fase 2 Schema + ledger
- ✅ Fase 3 Auth + roles
- ✅ Fase 4 CoreBankingAdapter (NovaCore) + mock
- ✅ Fase 5 Webhook de depósito (**verificado E2E**: 1M → 960k neto + 40k, ledger cuadra, idempotencia OK)
- ✅ Fase 6 Dashboards (cliente/broker/admin) — top nav + tarjetas
- ✅ Fase 7 Retiro SPEI + aprobación admin + webhook C
- ✅ Fase 8 Conversión USDT (Bitso usdt_mxn + 5¢, proceso manual)
- ✅ Fase 9 Deploy a Vercel

**En producción**: https://www.opmantis.com (alias) · deployment en `issac-villarruels-projects/operacion-mantis`.

### Pendientes operativos (cuando haya cliente real)
1. **Rotar la contraseña de Neon** (las credenciales se pegaron en el chat).
2. Quitar `USE_MOCK_CORE=1` en prod y dar de alta el `integration_api_key` real del cliente en NovaCore (CLABE, secrets) vía panel admin — falta construir el alta de cuentas/usuarios desde la UI admin.
3. Confirmar que el plan de Vercel permite el cron `*/5` (el deploy lo aceptó).
4. Cambiar contraseñas de los usuarios seed.

## Mapa de archivos clave
- `src/db/schema.ts` — 10 tablas + enums + relaciones
- `src/db/index.ts` — cliente Neon (ws) · `src/db/seed.ts` — seed
- `src/lib/money.ts` · `src/lib/ledger.ts` · `src/lib/crypto.ts`
- `src/lib/novacore/` — `types.ts`, `signatures.ts`, `client.ts`, `index.ts`
- `src/lib/auth/` — `password.ts`, `session.ts`, `index.ts`
- `src/lib/services/deposits.ts` — acreditación idempotente
- `src/app/api/novacore/deposit-received/route.ts` — Webhook A
- `src/proxy.ts` — protección de rutas
- `scripts/smoke-deposit.mjs`, `scripts/check-balance.mjs` — pruebas
