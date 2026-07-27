CREATE TABLE "payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"job_request_id" uuid NOT NULL,
	"payment_obligation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_session_id" text,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_job_request_id_job_requests_id_fk" FOREIGN KEY ("job_request_id") REFERENCES "public"."job_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_payment_obligation_id_payment_obligations_id_fk" FOREIGN KEY ("payment_obligation_id") REFERENCES "public"."payment_obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sessions_scope_idempotency_uq" ON "payment_sessions" USING btree ("tenant_id","account_id","provider","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sessions_provider_external_uq" ON "payment_sessions" USING btree ("provider","external_session_id");