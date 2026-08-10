-- Human-readable job reference for staff/customer UI.
-- Primary key remains UUID; display_id is unique per tenant.

ALTER TABLE "job_requests" ADD COLUMN IF NOT EXISTS "display_id" text;

WITH numbered AS (
  SELECT
    id,
    'GWG-' || lpad(
      (
        1000 + row_number() OVER (
          PARTITION BY tenant_id
          ORDER BY created_at ASC, id ASC
        )
      )::text,
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

ALTER TABLE "job_requests" ALTER COLUMN "display_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "job_requests_tenant_display_id_uq"
  ON "job_requests" USING btree ("tenant_id", "display_id");
