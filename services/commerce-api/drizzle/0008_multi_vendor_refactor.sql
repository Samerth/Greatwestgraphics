-- Phase 1: Multi-Vendor Refactor
-- Adds vendor registry, media management, payment schema, and field normalization

-- 1. Create payment status enum
CREATE TYPE payment_status AS ENUM (
  'not_started',
  'requires_payment',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded'
);

-- 2. Create vendors registry table
CREATE TABLE vendors (
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
CREATE INDEX vendors_tenant_key_idx ON vendors(tenant_id, key);

-- 3. Create media assets table
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  asset_type text NOT NULL,
  media_type text NOT NULL,
  vendor text NOT NULL,
  external_id text,
  s3_url text NOT NULL,
  thumbnail_url text,
  image_position text,
  width integer,
  height integer,
  file_size integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
CREATE INDEX media_assets_tenant_vendor_idx ON media_assets(tenant_id, vendor);
CREATE INDEX media_assets_asset_type_idx ON media_assets(asset_type);

-- 4. Create product_media linking table
CREATE TABLE product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL REFERENCES ss_products(id),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id),
  display_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT product_media_uq UNIQUE (tenant_id, product_id, media_asset_id)
);
CREATE INDEX product_media_product_idx ON product_media(product_id);

-- 5. Create product_3d_models table
CREATE TABLE product_3d_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL REFERENCES ss_products(id),
  vendor text,
  model_format text NOT NULL,
  s3_url text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL,
  ai_model text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT product_3d_models_uq UNIQUE (tenant_id, product_id, version)
);
CREATE INDEX product_3d_models_source_idx ON product_3d_models(source);

-- 6. Create vendor_field_mappings table
CREATE TABLE vendor_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vendor text NOT NULL,
  vendor_field text NOT NULL,
  universal_field text NOT NULL,
  data_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  transformation text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT vendor_field_mappings_uq UNIQUE (tenant_id, vendor, vendor_field)
);

-- 7. Create normalization_rules table
CREATE TABLE normalization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  field text NOT NULL,
  rule text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
CREATE INDEX normalization_rules_field_idx ON normalization_rules(field);

-- 8. Create Stripe checkout sessions table
CREATE TABLE stripe_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  stripe_session_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  client_secret text,
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  payment_status payment_status NOT NULL DEFAULT 'requires_payment',
  success_url text NOT NULL,
  cancel_url text NOT NULL,
  expires_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT stripe_sessions_job_request_uq UNIQUE (tenant_id, job_request_id)
);
CREATE INDEX stripe_sessions_status_idx ON stripe_checkout_sessions(payment_status);

-- 9. Create payment_intents table
CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_checkout_session_id uuid REFERENCES stripe_checkout_sessions(id),
  status text NOT NULL,
  amount_minor bigint NOT NULL,
  amount_received_minor bigint NOT NULL DEFAULT 0,
  failure_reason text,
  last_webhook_event_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
CREATE INDEX payment_intents_status_idx ON payment_intents(status);

-- 10. Create invoices table
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  stripe_invoice_id text,
  invoice_number text NOT NULL,
  status text NOT NULL,
  amount_minor bigint NOT NULL,
  amount_paid_minor bigint NOT NULL DEFAULT 0,
  amount_due_minor bigint NOT NULL,
  issued_at timestamp with time zone NOT NULL,
  due_at timestamp with time zone,
  paid_at timestamp with time zone,
  pdf_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT invoices_invoice_number_uq UNIQUE (tenant_id, invoice_number)
);
CREATE INDEX invoices_job_request_idx ON invoices(job_request_id);

-- 11. Create refunds table
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stripe_refund_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  amount_minor bigint NOT NULL,
  reason text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);

-- 12. Add vendor column to sync_runs table
ALTER TABLE sync_runs ADD COLUMN vendor_id uuid REFERENCES vendors(id);

-- 13. Add payment columns to job_requests table
ALTER TABLE job_requests ADD COLUMN payment_status payment_status DEFAULT 'not_started';
ALTER TABLE job_requests ADD COLUMN stripe_checkout_session_id uuid REFERENCES stripe_checkout_sessions(id);
ALTER TABLE job_requests ADD COLUMN final_quote_amount_minor bigint;
ALTER TABLE job_requests ADD COLUMN paid_at timestamp with time zone;

-- 14. Seed S&S Activewear as default vendor
INSERT INTO vendors (tenant_id, key, display_name, is_active, sync_adapter)
SELECT id, 'ss_activewear', 'S&S Activewear', true, 'SsSyncService'
FROM tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

-- 15. Seed Somar as vendor
INSERT INTO vendors (tenant_id, key, display_name, is_active, sync_adapter)
SELECT id, 'somar', 'Somar', true, 'SanmarSyncService'
FROM tenants
ON CONFLICT (tenant_id, key) DO NOTHING;

-- 16. Create CRM order sync table (for tracking order handoff to CRM)
CREATE TABLE crm_order_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  crm_order_id text,
  crm_system text NOT NULL,
  sync_status text NOT NULL,
  last_synced_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT crm_order_syncs_job_request_uq UNIQUE (tenant_id, job_request_id, crm_system)
);
CREATE INDEX crm_order_syncs_status_idx ON crm_order_syncs(sync_status);
CREATE INDEX crm_order_syncs_crm_order_idx ON crm_order_syncs(crm_order_id);

-- 17. Create CRM status update log (for tracking status changes from CRM)
CREATE TABLE crm_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  crm_system text NOT NULL,
  crm_status text NOT NULL,
  crm_status_code text,
  mapped_internal_status text,
  webhook_event_id text,
  is_processed boolean NOT NULL DEFAULT false,
  processed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
CREATE INDEX crm_status_updates_job_request_idx ON crm_status_updates(job_request_id);
CREATE INDEX crm_status_updates_is_processed_idx ON crm_status_updates(is_processed);

-- 18. Add CRM fields to job_requests
ALTER TABLE job_requests ADD COLUMN crm_order_id text;
ALTER TABLE job_requests ADD COLUMN crm_system text;
ALTER TABLE job_requests ADD COLUMN last_crm_sync_at timestamp with time zone;
