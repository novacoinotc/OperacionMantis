import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ────────────────────────────  Enums  ──────────────────────────── */

export const userRole = pgEnum("user_role", ["admin", "broker", "user"]);

export const withdrawalType = pgEnum("withdrawal_type", ["spei", "usdt"]);

export const withdrawalStatus = pgEnum("withdrawal_status", [
  "pending", // solicitado, espera aprobación del admin
  "approved", // admin aprobó, a punto de despachar / procesar
  "rejected", // admin rechazó (no descuenta saldo)
  "processing", // USDT: en proceso manual
  "sent", // SPEI: despachado a NovaCore (status "sent")
  "settled", // SPEI: liquidado (NovaCore "scattered")
  "returned", // SPEI: banco rechazó → reembolso
  "canceled", // SPEI: OPM canceló antes de enviar
  "failed", // falló validación → sin descuento
  "completed", // USDT: pagado manualmente
]);

// Cuentas del ledger de doble entrada (montos en centavos MXN).
export const ledgerAccount = pgEnum("ledger_account", [
  "core_cash", // activo: dinero físico en la CLABE del core (pool)
  "client_available", // pasivo: saldo neto disponible del cliente
  "platform_revenue", // ingreso de la plataforma (el 4%, menos gastos)
  "broker_payable", // por pagar al broker (su comisión acumulada)
  "usdt_payable", // por entregar en USDT (valor MXN comprometido)
  "pending_withdrawals", // saldo reservado en retiros en proceso (aún no liquidados)
]);

export const commissionStatus = pgEnum("commission_status", ["accrued", "paid"]);

export const payoutMethod = pgEnum("payout_method", ["spei", "crypto"]);
export const payoutStatus = pgEnum("payout_status", ["pending", "paid", "rejected"]);

/* ────────────────────────────  Users  ──────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ID del proveedor de auth (Clerk). Nullable hasta enlazar.
    authProviderId: text("auth_provider_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name"),
    role: userRole("role").notNull().default("user"),
    // El broker que "posee" a este usuario (jerarquía broker → clientes).
    brokerId: uuid("broker_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    // Login adicional que COMPARTE la cuenta de otro cliente (no es el dueño).
    clientAccountId: uuid("client_account_id").references((): AnyPgColumn => clientAccounts.id, {
      onDelete: "set null",
    }),
    passwordHash: text("password_hash"), // por si se usa auth con credenciales
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("users_broker_idx").on(t.brokerId), index("users_role_idx").on(t.role)],
);

/* ──────────────────────  Client accounts  ──────────────────────── */
/* Una cuenta por cliente final. Guarda credenciales de NovaCore (cifradas),
   configuración de comisiones y el saldo neto cacheado. */

export const clientAccounts = pgTable(
  "client_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    label: text("label"),

    // ── Integración NovaCore (por tenant) ──
    novacoreApiKeyPrefix: text("novacore_api_key_prefix"), // 8 chars, identifica tenant en webhook A
    novacoreClabe: text("novacore_clabe"), // CLABE de SALIDA (source de los SPEI; informativa)
    // CLABEs de DEPÓSITO que acreditan a este saldo consolidado.
    depositClabes: text("deposit_clabes").array(),
    encApiKey: text("enc_api_key"), // AES-256-GCM del api key plaintext
    encWebhookSecret: text("enc_webhook_secret"), // secret webhook C (status retiro)
    encDepositSecret: text("enc_deposit_secret"), // secret webhook A (depósito)
    payerName: text("payer_name"),
    payerRfc: text("payer_rfc"),
    maxAmountPerOperation: bigint("max_amount_per_operation", { mode: "number" })
      .notNull()
      .default(5_000_000_00), // $50,000.00 MXN en centavos

    // ── Configuración de comisiones (puntos base) ──
    commissionBps: integer("commission_bps").notNull().default(400), // 4.00% al cliente final
    brokerSpeiBps: integer("broker_spei_bps").notNull().default(150), // 1.50% al broker (SPEI)
    brokerCryptoBps: integer("broker_crypto_bps").notNull().default(120), // 1.20% al broker (crypto)
    usdtMarkupCentavos: integer("usdt_markup_centavos").notNull().default(5), // +5¢ MXN por USDT

    // ── Saldo neto cacheado (fuente de verdad = ledger) ──
    availableBalance: bigint("available_balance", { mode: "number" }).notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("client_accounts_clabe_idx").on(t.novacoreClabe),
    index("client_accounts_prefix_idx").on(t.novacoreApiKeyPrefix),
  ],
);

/* ────────────────────────────  Deposits  ───────────────────────── */

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "restrict" }),
    // Idempotencia con NovaCore.
    trackingKey: text("tracking_key").notNull().unique(),
    grossAmount: bigint("gross_amount", { mode: "number" }).notNull(), // lo que llegó
    commissionAmount: bigint("commission_amount", { mode: "number" }).notNull(), // el 4%
    netAmount: bigint("net_amount", { mode: "number" }).notNull(), // gross - 4%
    commissionBps: integer("commission_bps").notNull(), // bps aplicados (snapshot)
    currency: text("currency").notNull().default("MXN"),
    payerName: text("payer_name"),
    payerAccount: text("payer_account"),
    beneficiaryAccount: text("beneficiary_account"),
    concept: text("concept"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    source: text("source").notNull().default("webhook"), // "webhook" | "reconciliation"
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("deposits_account_idx").on(t.clientAccountId),
    index("deposits_received_idx").on(t.receivedAt),
  ],
);

/* ──────────────  Anti-replay de webhooks (nonces)  ──────────────── */

export const webhookNonces = pgTable("webhook_nonces", {
  nonce: text("nonce").primaryKey(),
  seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ──────────────────────────  Withdrawals  ──────────────────────── */

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "restrict" }),
    type: withdrawalType("type").notNull(),
    status: withdrawalStatus("status").notNull().default("pending"),
    // Idempotencia hacia NovaCore (spei-dispatch).
    externalReference: text("external_reference").notNull().unique(),

    // Monto NETO en MXN que el cliente pide (se descuenta de available_balance).
    amount: bigint("amount", { mode: "number" }).notNull(),
    // Bruto-equivalente = amount / (1 - commissionBps) — base de la comisión del broker.
    grossEquivalent: bigint("gross_equivalent", { mode: "number" }).notNull(),
    // Comisión del broker (gasto interno, NO se resta al dispatch).
    brokerCommission: bigint("broker_commission", { mode: "number" }).notNull().default(0),
    brokerBps: integer("broker_bps").notNull().default(0),

    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    // ── SPEI ──
    beneficiaryAccount: text("beneficiary_account"),
    beneficiaryName: text("beneficiary_name"),
    beneficiaryRfc: text("beneficiary_rfc"),
    concept: text("concept"),
    novacoreTransactionId: text("novacore_transaction_id"),
    novacoreTrackingKey: text("novacore_tracking_key"),
    novacoreStatus: text("novacore_status"),

    // ── USDT ──
    bitsoRate: numeric("bitso_rate", { precision: 18, scale: 6 }), // MXN/USDT base de Bitso
    markupCentavos: integer("markup_centavos"), // +5¢ aplicados
    effectiveRate: numeric("effective_rate", { precision: 18, scale: 6 }), // rate + markup
    usdtAmount: bigint("usdt_amount", { mode: "number" }), // micro-USDT (1 USDT = 1e6)
    usdtAddress: text("usdt_address"),
    usdtNetwork: text("usdt_network"),
    usdtTxHash: text("usdt_tx_hash"),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("withdrawals_account_idx").on(t.clientAccountId),
    index("withdrawals_status_idx").on(t.status),
    index("withdrawals_tracking_idx").on(t.novacoreTrackingKey),
  ],
);

/* ──────────────────────  Broker commissions  ───────────────────── */

export const brokerCommissions = pgTable(
  "broker_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brokerUserId: uuid("broker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => clientAccounts.id, { onDelete: "restrict" }),
    withdrawalId: uuid("withdrawal_id").references(() => withdrawals.id, {
      onDelete: "set null",
    }),
    type: withdrawalType("type").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // centavos
    bps: integer("bps").notNull(),
    status: commissionStatus("status").notNull().default("accrued"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("broker_commissions_broker_idx").on(t.brokerUserId),
    index("broker_commissions_status_idx").on(t.status),
  ],
);

/* ──────────────────────  Broker payouts  ───────────────────────── */
/* Solicitud del broker para cobrar sus comisiones acumuladas. */

export const brokerPayouts = pgTable(
  "broker_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brokerUserId: uuid("broker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    method: payoutMethod("method").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(), // centavos
    destinationClabe: text("destination_clabe"),
    destinationName: text("destination_name"),
    destinationAddress: text("destination_address"),
    destinationNetwork: text("destination_network"),
    status: payoutStatus("status").notNull().default("pending"),
    txHash: text("tx_hash"),
    reference: text("reference"),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("broker_payouts_broker_idx").on(t.brokerUserId, t.status)],
);

/* ────────────────────────  USDT quotes  ────────────────────────── */

export const usdtQuotes = pgTable("usdt_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  book: text("book").notNull().default("usd_mxn"),
  bid: numeric("bid", { precision: 18, scale: 6 }),
  ask: numeric("ask", { precision: 18, scale: 6 }),
  last: numeric("last", { precision: 18, scale: 6 }),
  raw: jsonb("raw"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ────────────────────────  Ledger entries  ─────────────────────── */
/* Doble entrada. amount = delta con signo al saldo de (account, owner). */

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    txnId: uuid("txn_id").notNull(), // agrupa entradas de una misma transacción
    account: ledgerAccount("account").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    clientAccountId: uuid("client_account_id").references(() => clientAccounts.id),
    amount: bigint("amount", { mode: "number" }).notNull(), // centavos, con signo
    currency: text("currency").notNull().default("MXN"),
    refType: text("ref_type"), // "deposit" | "withdrawal" | "commission" | "adjustment"
    refId: uuid("ref_id"),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ledger_txn_idx").on(t.txnId),
    index("ledger_account_owner_idx").on(t.account, t.ownerUserId),
    index("ledger_client_idx").on(t.clientAccountId),
  ],
);

/* ──────────────────────────  Audit log  ────────────────────────── */

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ───────────────────────────  Settings  ────────────────────────── */

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("singleton"),
  novacoreBaseUrl: text("novacore_base_url"),
  defaultCommissionBps: integer("default_commission_bps").notNull().default(400),
  defaultBrokerSpeiBps: integer("default_broker_spei_bps").notNull().default(150),
  defaultBrokerCryptoBps: integer("default_broker_crypto_bps").notNull().default(120),
  defaultUsdtMarkupCentavos: integer("default_usdt_markup_centavos").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ──────────────────────────  Relations  ────────────────────────── */

export const usersRelations = relations(users, ({ one, many }) => ({
  broker: one(users, {
    fields: [users.brokerId],
    references: [users.id],
    relationName: "broker_clients",
  }),
  clients: many(users, { relationName: "broker_clients" }),
  account: one(clientAccounts, {
    fields: [users.id],
    references: [clientAccounts.userId],
  }),
}));

export const clientAccountsRelations = relations(clientAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [clientAccounts.userId],
    references: [users.id],
  }),
  deposits: many(deposits),
  withdrawals: many(withdrawals),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [deposits.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [withdrawals.clientAccountId],
    references: [clientAccounts.id],
  }),
  requestedBy: one(users, {
    fields: [withdrawals.requestedByUserId],
    references: [users.id],
  }),
}));

/* ──────────────────────────  Type exports  ─────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ClientAccount = typeof clientAccounts.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type BrokerCommission = typeof brokerCommissions.$inferSelect;
