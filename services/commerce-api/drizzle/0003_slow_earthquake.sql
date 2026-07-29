CREATE TABLE "catalog_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"retail_markup" text DEFAULT '2.0' NOT NULL,
	"brand_allowlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storage_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "category_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_uuid" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_category_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ss_category_key" text NOT NULL,
	"ss_category_label" text,
	"category_id" uuid NOT NULL,
	"product_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_uuid" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"assignment_source" text DEFAULT 'map' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"style_uuid" uuid NOT NULL,
	"style_id" integer NOT NULL,
	"color_name" text NOT NULL,
	"color_code" text,
	"color1" text,
	"color2" text,
	"is_dark" boolean DEFAULT false NOT NULL,
	"color_front_image_path" text,
	"color_side_image_path" text,
	"color_back_image_path" text,
	"color_swatch_image_path" text,
	"color_front_image_url" text,
	"color_side_image_url" text,
	"color_back_image_url" text,
	"color_swatch_image_url" text,
	"material_config" jsonb,
	"qty" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"style_id" integer NOT NULL,
	"part_number" text,
	"brand_name" text NOT NULL,
	"style_name" text NOT NULL,
	"title" text,
	"description" text,
	"base_category" text,
	"ss_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_image_path" text,
	"style_image_path" text,
	"brand_image_url" text,
	"style_image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"model_url" text,
	"model_status" text DEFAULT 'none' NOT NULL,
	"model_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_unmapped_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ss_category_key" text NOT NULL,
	"ss_category_label" text,
	"style_count" integer DEFAULT 0 NOT NULL,
	"sample_style_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "ss_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_uuid" uuid NOT NULL,
	"sku_id" integer NOT NULL,
	"sku" text NOT NULL,
	"gtin" text,
	"size_name" text NOT NULL,
	"size_code" text,
	"size_order" integer DEFAULT 0 NOT NULL,
	"customer_price_minor" bigint NOT NULL,
	"map_price_minor" bigint,
	"qty" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"styles_processed" integer DEFAULT 0 NOT NULL,
	"skus_upserted" integer DEFAULT 0 NOT NULL,
	"images_downloaded" integer DEFAULT 0 NOT NULL,
	"rate_limit_remaining" integer,
	"error_summary" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" jsonb,
	"source" jsonb
);
--> statement-breakpoint
ALTER TABLE "catalog_settings" ADD CONSTRAINT "catalog_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_product_uuid_ss_products_id_fk" FOREIGN KEY ("product_uuid") REFERENCES "public"."ss_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_category_map" ADD CONSTRAINT "ss_category_map_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_category_map" ADD CONSTRAINT "ss_category_map_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_product_categories" ADD CONSTRAINT "ss_product_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_product_categories" ADD CONSTRAINT "ss_product_categories_product_uuid_ss_products_id_fk" FOREIGN KEY ("product_uuid") REFERENCES "public"."ss_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_product_categories" ADD CONSTRAINT "ss_product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_products" ADD CONSTRAINT "ss_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_products" ADD CONSTRAINT "ss_products_style_uuid_ss_styles_id_fk" FOREIGN KEY ("style_uuid") REFERENCES "public"."ss_styles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_styles" ADD CONSTRAINT "ss_styles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_unmapped_categories" ADD CONSTRAINT "ss_unmapped_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_variants" ADD CONSTRAINT "ss_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ss_variants" ADD CONSTRAINT "ss_variants_product_uuid_ss_products_id_fk" FOREIGN KEY ("product_uuid") REFERENCES "public"."ss_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_settings_tenant_uq" ON "catalog_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_tenant_slug_uq" ON "categories" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "categories_tenant_parent_idx" ON "categories" USING btree ("tenant_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_overrides_uq" ON "category_overrides" USING btree ("tenant_id","product_uuid","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_category_map_uq" ON "ss_category_map" USING btree ("tenant_id","ss_category_key","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_product_categories_uq" ON "ss_product_categories" USING btree ("tenant_id","product_uuid","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_products_tenant_style_color_uq" ON "ss_products" USING btree ("tenant_id","style_id","color_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_products_tenant_slug_uq" ON "ss_products" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "ss_products_tenant_style_uuid_idx" ON "ss_products" USING btree ("tenant_id","style_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_styles_tenant_style_id_uq" ON "ss_styles" USING btree ("tenant_id","style_id");--> statement-breakpoint
CREATE INDEX "ss_styles_tenant_brand_idx" ON "ss_styles" USING btree ("tenant_id","brand_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_unmapped_categories_uq" ON "ss_unmapped_categories" USING btree ("tenant_id","ss_category_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_variants_tenant_sku_id_uq" ON "ss_variants" USING btree ("tenant_id","sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ss_variants_tenant_sku_uq" ON "ss_variants" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "ss_variants_tenant_product_idx" ON "ss_variants" USING btree ("tenant_id","product_uuid");--> statement-breakpoint
CREATE INDEX "sync_runs_tenant_started_idx" ON "sync_runs" USING btree ("tenant_id","started_at");