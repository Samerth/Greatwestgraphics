-- Staff inbox catch-up. 0020 added last_crm_sync_at, but staging often runs
-- `02-migrate-drizzle.sh` from `main`, which does not yet contain 0020, so
-- drizzle reports success and the column is still missing. Repeat every
-- `job_requests` column the ORM list query can touch, plus the obligations
-- table the invoice-requested badge reads.
--
-- IF NOT EXISTS / CREATE IF NOT EXISTS so a database that already applied
-- 0008–0020 is a no-op.

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
  ADD COLUMN IF NOT EXISTS display_id text;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'not_started';
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id uuid;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS final_quote_amount_minor bigint;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS cod_crm_job_id text;
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS last_crm_sync_at timestamp with time zone;

WITH numbered AS (
  SELECT
    id,
    'GWG-' || lpad(
      (1000 + row_number() OVER (
        PARTITION BY tenant_id
        ORDER BY created_at ASC, id ASC
      ))::text,
      4,
      '0'
    ) AS display_id
  FROM job_requests
  WHERE display_id IS NULL
)
UPDATE job_requests AS j
SET display_id = numbered.display_id
FROM numbered
WHERE j.id = numbered.id;

CREATE TABLE IF NOT EXISTS payment_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL,
  job_request_id uuid NOT NULL REFERENCES job_requests(id),
  final_quote_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  external_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by jsonb,
  source jsonb
);
