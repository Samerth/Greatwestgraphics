-- The Drizzle snapshot has described `cod_crm_job_id` on `job_requests` and
-- `crm_order_syncs`, and `cod_crm_status` on `crm_status_updates`, since 0008 —
-- but no migration ever created them. 0008 added `crm_order_id` / `crm_system`
-- instead, and the snapshot was regenerated without a matching migration file.
-- `drizzle-kit migrate` therefore reported a fully migrated database while the
-- columns the ORM selects did not exist.
--
-- This is not a cosmetic drift. Drizzle expands `select()` and `.returning()`
-- into an explicit column list built from the schema, so every read and write
-- of `job_requests` emitted `cod_crm_job_id` and Postgres answered 42703
-- undefined_column. That took out job request creation, submission, the portal
-- job list and job detail entirely — the storefront's whole quote-to-job path.
--
-- Written idempotently because staging and production are at different points
-- and this needs to be safe to re-run against either.

-- Some early development databases recorded 0008 without retaining its CRM
-- tables. Repair that drift before adding the catch-up columns so a database
-- with a complete journal but incomplete schema can still migrate forward.
CREATE TABLE IF NOT EXISTS crm_order_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  cod_crm_job_id text,
  sync_status text NOT NULL,
  last_synced_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb,
  CONSTRAINT crm_order_syncs_job_request_uq UNIQUE (tenant_id, job_request_id)
);

CREATE TABLE IF NOT EXISTS crm_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  cod_crm_status text,
  mapped_internal_status text,
  is_processed boolean NOT NULL DEFAULT false,
  processed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS cod_crm_job_id text;

-- 0008 was recorded on some databases without applying its payment ALTER
-- TABLEs. This file then created job_requests_payment_status_idx and
-- Postgres answered 42703 (column does not exist), which is the CloudShell
-- migrate failure. Add the columns before the index.
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'not_started',
    'requires_payment',
    'processing',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'not_started';
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id uuid;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS final_quote_amount_minor bigint;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

ALTER TABLE crm_order_syncs
  ADD COLUMN IF NOT EXISTS cod_crm_job_id text;

-- `cod_crm_status` is NOT NULL in the snapshot, but backfilling a default onto
-- an existing table would invent CRM statuses that never came from the CRM.
-- The table is empty on every environment (nothing could write to it), so the
-- column is added nullable here and left for the CRM integration to tighten
-- when it actually starts writing rows.
ALTER TABLE crm_status_updates
  ADD COLUMN IF NOT EXISTS cod_crm_status text;

CREATE INDEX IF NOT EXISTS crm_order_syncs_status_idx
  ON crm_order_syncs (sync_status);

CREATE INDEX IF NOT EXISTS crm_status_updates_job_request_idx
  ON crm_status_updates (job_request_id);

CREATE INDEX IF NOT EXISTS crm_status_updates_is_processed_idx
  ON crm_status_updates (is_processed);

CREATE INDEX IF NOT EXISTS job_requests_cod_crm_job_id_idx
  ON job_requests (cod_crm_job_id);

CREATE INDEX IF NOT EXISTS job_requests_payment_status_idx
  ON job_requests (payment_status);
