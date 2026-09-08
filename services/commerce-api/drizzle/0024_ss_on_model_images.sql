-- On-model/lifestyle product photography, separate from the flat garment
-- shots ss_products already stores. S&S's v2 API returns these as their own
-- named fields (colorOnModelFrontImage etc.) — see
-- services/commerce-api/src/adapters/ss-activewear/client.ts.
--
-- Additive only: nullable, never overwrites colorFrontImageUrl/etc. The
-- flat shots stay exactly as they are so the PDP's full image gallery still
-- has them (CodSphere UAT — "Product pages can continue to show the full
-- image gallery"). Only the *primary* catalogue/PDP image prefers these
-- when present (lib/commerce/catalog-images.ts).
--
-- IF NOT EXISTS so a database that already has these (e.g. a hand-patched
-- environment) sees a no-op, matching this repo's existing migrations
-- (0020, 0021, 0023).
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_front_image_path" text;
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_side_image_path" text;
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_back_image_path" text;
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_front_image_url" text;
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_side_image_url" text;
ALTER TABLE "ss_products" ADD COLUMN IF NOT EXISTS "color_on_model_back_image_url" text;
