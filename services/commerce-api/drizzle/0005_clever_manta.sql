CREATE TABLE "store_category_visibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "pricing_adjustment_percent" text;--> statement-breakpoint
ALTER TABLE "store_category_visibility" ADD CONSTRAINT "store_category_visibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category_visibility" ADD CONSTRAINT "store_category_visibility_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_category_visibility" ADD CONSTRAINT "store_category_visibility_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_category_visibility_uq" ON "store_category_visibility" USING btree ("store_id","category_id");--> statement-breakpoint
CREATE INDEX "store_category_visibility_store_idx" ON "store_category_visibility" USING btree ("store_id");