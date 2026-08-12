-- Pricing config v2 stores decoration methods as data instead of fixed columns.
-- v1 and v2 configs live side by side while the customer quote path still reads
-- v1, so the uniqueness rules are scoped per schema version: one published
-- config and one draft per tenant *per schema version*.

ALTER TABLE pricing_configs
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS pricing_configs_tenant_version_uq;
DROP INDEX IF EXISTS pricing_configs_tenant_published_uq;

CREATE UNIQUE INDEX IF NOT EXISTS pricing_configs_tenant_schema_version_uq
  ON pricing_configs (tenant_id, schema_version, version);

CREATE UNIQUE INDEX IF NOT EXISTS pricing_configs_tenant_schema_published_uq
  ON pricing_configs (tenant_id, schema_version)
  WHERE status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS pricing_configs_tenant_schema_draft_uq
  ON pricing_configs (tenant_id, schema_version)
  WHERE status = 'draft';
