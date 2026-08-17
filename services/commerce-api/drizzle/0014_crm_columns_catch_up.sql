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

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS cod_crm_job_id text;

ALTER TABLE crm_order_syncs
  ADD COLUMN IF NOT EXISTS cod_crm_job_id text;

-- `cod_crm_status` is NOT NULL in the snapshot, but backfilling a default onto
-- an existing table would invent CRM statuses that never came from the CRM.
-- The table is empty on every environment (nothing could write to it), so the
-- column is added nullable here and left for the CRM integration to tighten
-- when it actually starts writing rows.
ALTER TABLE crm_status_updates
  ADD COLUMN IF NOT EXISTS cod_crm_status text;

CREATE INDEX IF NOT EXISTS job_requests_cod_crm_job_id_idx
  ON job_requests (cod_crm_job_id);

CREATE INDEX IF NOT EXISTS job_requests_payment_status_idx
  ON job_requests (payment_status);
