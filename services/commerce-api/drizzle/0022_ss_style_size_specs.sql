-- S&S Activewear publishes garment measurements on GET /v2/specs/
-- (sizeName + specName + value). Styles/Products do not include a size-chart
-- URL. Persist those rows on the style so the shop PDP can render a chart.
--
-- ECS does not migrate on boot. After merge, run `npm run db:migrate` from
-- CloudShell/ops against staging. Catalog list queries omit this column;
-- product detail treats a missing column as "no specs" so the shop stays up.
ALTER TABLE "ss_styles" ADD COLUMN IF NOT EXISTS "size_specs" jsonb;
