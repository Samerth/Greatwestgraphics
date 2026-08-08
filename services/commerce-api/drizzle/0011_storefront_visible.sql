-- Soft-hide colorways from the storefront without losing vendor sync state.
-- staff hide = storefront_visible; vendor discontinued remains `active`.
-- Full/inventory sync must never overwrite storefront_visible (or hidden_*).

ALTER TABLE ss_products
  ADD COLUMN IF NOT EXISTS storefront_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by jsonb;

CREATE INDEX IF NOT EXISTS ss_products_tenant_storefront_visible_idx
  ON ss_products (tenant_id, storefront_visible);
