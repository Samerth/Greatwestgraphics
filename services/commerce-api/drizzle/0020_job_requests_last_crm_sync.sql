-- The staff inbox (`GET /internal/dev/job-requests`) expands `jobRequests`
-- into an explicit column list. `last_crm_sync_at` has been on the ORM
-- schema since 0008, but 0008 was journaled on staging without applying its
-- trailing ALTER TABLEs. 0014 then added `cod_crm_job_id` and the payment
-- columns so the payment index could be created — and stopped there.
--
-- The inbox therefore emits `SELECT … last_crm_sync_at …` against a table
-- that does not have it. Postgres answers 42703, Fastify turns that into
-- "An unexpected error occurred", and every queue count stays 0 because
-- the list never returns.
--
-- IF NOT EXISTS so a database that actually applied 0008 is a no-op.

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS last_crm_sync_at timestamp with time zone;
