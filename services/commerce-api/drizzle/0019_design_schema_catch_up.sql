-- Catch-up for databases Drizzle marked migrated while the live schema lagged.
-- Saving a Design Studio project always writes placement_by_side; listing it
-- always SELECTs that column. Without it Postgres raises 42703 and customer
-- /design (and jobs that persist the design) fail.
--
-- IF NOT EXISTS so a database that already ran 0015–0016 is a no-op.

ALTER TABLE "design_projects" ADD COLUMN IF NOT EXISTS "placement_by_side" jsonb;
--> statement-breakpoint
ALTER TABLE "design_projects" ADD COLUMN IF NOT EXISTS "updated_by" jsonb;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "is_public" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "final_quotes" ADD COLUMN IF NOT EXISTS "note" text;
