-- Admin-configurable decoration-method / decoration-location allow-list per
-- category (CodSphere UAT V2, "Product-Specific Decoration Methods & Print
-- Locations"). Both columns are nullable arrays; null/empty means
-- unrestricted, which is every existing row's current, unchanged behaviour.
--
-- IF NOT EXISTS so a database that already has these (e.g. a hand-patched
-- environment) sees a no-op, matching this repo's existing migrations.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "allowed_decoration_methods" text[];
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "allowed_decoration_locations" text[];
