CREATE TABLE "design_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"garment_product_id" uuid,
	"artworks_by_side" jsonb NOT NULL,
	"proof_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_garment_product_id_ss_products_id_fk" FOREIGN KEY ("garment_product_id") REFERENCES "public"."ss_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_projects_tenant_person_idx" ON "design_projects" USING btree ("tenant_id","person_id");