-- Multi-vendor catalog namespace: every style/product/variant belongs to a vendor.
-- External string keys (Sanmar style codes, CSV IDs) live alongside numeric ids
-- used for S&S compatibility and stable hashing for non-numeric vendors.

ALTER TABLE ss_styles
  ADD COLUMN IF NOT EXISTS vendor text NOT NULL DEFAULT 'ss_activewear',
  ADD COLUMN IF NOT EXISTS external_key text;

ALTER TABLE ss_products
  ADD COLUMN IF NOT EXISTS vendor text NOT NULL DEFAULT 'ss_activewear';

ALTER TABLE ss_variants
  ADD COLUMN IF NOT EXISTS vendor text NOT NULL DEFAULT 'ss_activewear',
  ADD COLUMN IF NOT EXISTS external_key text;

ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS vendor text;

-- Replace tenant-only uniqueness with vendor-scoped uniqueness.
DROP INDEX IF EXISTS ss_styles_tenant_style_id_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ss_styles_tenant_vendor_style_id_uq
  ON ss_styles (tenant_id, vendor, style_id);
CREATE UNIQUE INDEX IF NOT EXISTS ss_styles_tenant_vendor_external_key_uq
  ON ss_styles (tenant_id, vendor, external_key)
  WHERE external_key IS NOT NULL;

DROP INDEX IF EXISTS ss_products_tenant_style_color_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ss_products_tenant_vendor_style_color_uq
  ON ss_products (tenant_id, vendor, style_id, color_name);

DROP INDEX IF EXISTS ss_variants_tenant_sku_id_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ss_variants_tenant_vendor_sku_id_uq
  ON ss_variants (tenant_id, vendor, sku_id);

DROP INDEX IF EXISTS ss_variants_tenant_sku_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ss_variants_tenant_vendor_sku_uq
  ON ss_variants (tenant_id, vendor, sku);
CREATE UNIQUE INDEX IF NOT EXISTS ss_variants_tenant_vendor_external_key_uq
  ON ss_variants (tenant_id, vendor, external_key)
  WHERE external_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ss_styles_tenant_vendor_idx ON ss_styles (tenant_id, vendor);
CREATE INDEX IF NOT EXISTS ss_products_tenant_vendor_idx ON ss_products (tenant_id, vendor);
CREATE INDEX IF NOT EXISTS ss_variants_tenant_vendor_idx ON ss_variants (tenant_id, vendor);
CREATE INDEX IF NOT EXISTS sync_runs_tenant_vendor_idx ON sync_runs (tenant_id, vendor);

-- Ensure vendors registry exists (from 0008; safe if already applied).
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sync_adapter text,
  config jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT vendors_tenant_key_uq UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS vendors_tenant_key_idx ON vendors (tenant_id, key);
