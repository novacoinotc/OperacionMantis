CREATE TYPE "public"."commission_status" AS ENUM('accrued', 'paid');--> statement-breakpoint
CREATE TYPE "public"."ledger_account" AS ENUM('core_cash', 'client_available', 'platform_revenue', 'broker_payable', 'usdt_payable', 'pending_withdrawals');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'broker', 'user');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected', 'processing', 'sent', 'settled', 'returned', 'canceled', 'failed', 'completed');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_type" AS ENUM('spei', 'usdt');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"novacore_base_url" text,
	"default_commission_bps" integer DEFAULT 400 NOT NULL,
	"default_broker_spei_bps" integer DEFAULT 150 NOT NULL,
	"default_broker_crypto_bps" integer DEFAULT 120 NOT NULL,
	"default_usdt_markup_centavos" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_user_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"withdrawal_id" uuid,
	"type" "withdrawal_type" NOT NULL,
	"amount" bigint NOT NULL,
	"bps" integer NOT NULL,
	"status" "commission_status" DEFAULT 'accrued' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"novacore_api_key_prefix" text,
	"novacore_clabe" text,
	"enc_api_key" text,
	"enc_webhook_secret" text,
	"enc_deposit_secret" text,
	"payer_name" text,
	"payer_rfc" text,
	"max_amount_per_operation" bigint DEFAULT 500000000 NOT NULL,
	"commission_bps" integer DEFAULT 400 NOT NULL,
	"broker_spei_bps" integer DEFAULT 150 NOT NULL,
	"broker_crypto_bps" integer DEFAULT 120 NOT NULL,
	"usdt_markup_centavos" integer DEFAULT 5 NOT NULL,
	"available_balance" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"tracking_key" text NOT NULL,
	"gross_amount" bigint NOT NULL,
	"commission_amount" bigint NOT NULL,
	"net_amount" bigint NOT NULL,
	"commission_bps" integer NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"payer_name" text,
	"payer_account" text,
	"beneficiary_account" text,
	"concept" text,
	"received_at" timestamp with time zone,
	"source" text DEFAULT 'webhook' NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_tracking_key_unique" UNIQUE("tracking_key")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"txn_id" uuid NOT NULL,
	"account" "ledger_account" NOT NULL,
	"owner_user_id" uuid,
	"client_account_id" uuid,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usdt_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book" text DEFAULT 'usd_mxn' NOT NULL,
	"bid" numeric(18, 6),
	"ask" numeric(18, 6),
	"last" numeric(18, 6),
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider_id" text,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"broker_id" uuid,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_provider_id_unique" UNIQUE("auth_provider_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"type" "withdrawal_type" NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"external_reference" text NOT NULL,
	"amount" bigint NOT NULL,
	"gross_equivalent" bigint NOT NULL,
	"broker_commission" bigint DEFAULT 0 NOT NULL,
	"broker_bps" integer DEFAULT 0 NOT NULL,
	"requested_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"beneficiary_account" text,
	"beneficiary_name" text,
	"beneficiary_rfc" text,
	"concept" text,
	"novacore_transaction_id" text,
	"novacore_tracking_key" text,
	"novacore_status" text,
	"bitso_rate" numeric(18, 6),
	"markup_centavos" integer,
	"effective_rate" numeric(18, 6),
	"usdt_amount" bigint,
	"usdt_address" text,
	"usdt_network" text,
	"usdt_tx_hash" text,
	"processed_by_user_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawals_external_reference_unique" UNIQUE("external_reference")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_broker_user_id_users_id_fk" FOREIGN KEY ("broker_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_withdrawal_id_withdrawals_id_fk" FOREIGN KEY ("withdrawal_id") REFERENCES "public"."withdrawals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_broker_id_users_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_client_account_id_client_accounts_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_commissions_broker_idx" ON "broker_commissions" USING btree ("broker_user_id");--> statement-breakpoint
CREATE INDEX "broker_commissions_status_idx" ON "broker_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_accounts_clabe_idx" ON "client_accounts" USING btree ("novacore_clabe");--> statement-breakpoint
CREATE INDEX "client_accounts_prefix_idx" ON "client_accounts" USING btree ("novacore_api_key_prefix");--> statement-breakpoint
CREATE INDEX "deposits_account_idx" ON "deposits" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "deposits_received_idx" ON "deposits" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "ledger_txn_idx" ON "ledger_entries" USING btree ("txn_id");--> statement-breakpoint
CREATE INDEX "ledger_account_owner_idx" ON "ledger_entries" USING btree ("account","owner_user_id");--> statement-breakpoint
CREATE INDEX "ledger_client_idx" ON "ledger_entries" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "users_broker_idx" ON "users" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "withdrawals_account_idx" ON "withdrawals" USING btree ("client_account_id");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawals_tracking_idx" ON "withdrawals" USING btree ("novacore_tracking_key");