-- Two additions to the admin Job Details page rebuild (client's 11-point
-- note): a shared internal staff note ("This does not need CRM
-- functionality… simply a note attached to the order"), and staff
-- confirmation of a rush request's date.
--
-- `promised_date` is kept separate from the customer's own requested date,
-- which lives in the immutable job_request_snapshots row — shops negotiate,
-- and what staff actually commit to may differ from what was first asked
-- for. All six columns are nullable with no default, so this ALTER cannot
-- rewrite the table.
--
-- IF NOT EXISTS per this repo's own house rule (see 0020's comment): Drizzle
-- select()/returning() emit every schema column, so if this migration is
-- journaled without actually being applied, every job read 500s with 42703.
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS internal_note_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS internal_note_updated_by jsonb,
  ADD COLUMN IF NOT EXISTS rush_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS promised_date date,
  ADD COLUMN IF NOT EXISTS rush_confirmed_by jsonb;
