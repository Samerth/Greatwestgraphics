CREATE TYPE "public"."store_status" AS ENUM('pending_review', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "account_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
ALTER TABLE "account_people" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "status" "store_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "custom_domain" text;--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invites" ADD CONSTRAINT "account_invites_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_invites_token_uq" ON "account_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "account_invites_tenant_account_email_idx" ON "account_invites" USING btree ("tenant_id","account_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_tenant_slug_uq" ON "stores" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_custom_domain_uq" ON "stores" USING btree ("custom_domain");