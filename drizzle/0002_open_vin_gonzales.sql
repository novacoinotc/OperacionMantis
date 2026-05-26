CREATE TYPE "public"."payout_method" AS ENUM('spei', 'crypto');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid', 'rejected');--> statement-breakpoint
CREATE TABLE "broker_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_user_id" uuid NOT NULL,
	"method" "payout_method" NOT NULL,
	"amount" bigint NOT NULL,
	"destination_clabe" text,
	"destination_name" text,
	"destination_address" text,
	"destination_network" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"reference" text,
	"processed_by_user_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broker_payouts" ADD CONSTRAINT "broker_payouts_broker_user_id_users_id_fk" FOREIGN KEY ("broker_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_payouts" ADD CONSTRAINT "broker_payouts_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_payouts_broker_idx" ON "broker_payouts" USING btree ("broker_user_id","status");