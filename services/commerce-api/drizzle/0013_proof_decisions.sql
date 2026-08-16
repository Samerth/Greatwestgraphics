-- Proofs already carried a `decision` column, but nothing could ever write it:
-- there was no endpoint to decide a proof, and no room to record who decided or
-- why. These columns close the review round trip.
--
-- `awaiting_decision_from` names the party a proof is blocked on. It is stored
-- rather than derived from the creating actor so that "what is waiting on me"
-- stays a plain indexed lookup, and so a proof can be re-aimed (staff revising
-- a customer's artwork and sending it back) without rewriting history.

ALTER TABLE proof_versions
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE proof_versions
  ADD COLUMN IF NOT EXISTS decided_by jsonb;

ALTER TABLE proof_versions
  ADD COLUMN IF NOT EXISTS decision_note text;

ALTER TABLE proof_versions
  ADD COLUMN IF NOT EXISTS awaiting_decision_from text;

-- Proofs that predate this migration were all raised by staff for a customer to
-- sign off, which is the only path the admin UI offered.
UPDATE proof_versions
   SET awaiting_decision_from = 'customer'
 WHERE awaiting_decision_from IS NULL
   AND (decision IS NULL OR decision = 'pending');

CREATE INDEX IF NOT EXISTS proof_versions_awaiting_idx
  ON proof_versions (tenant_id, awaiting_decision_from)
  WHERE decision = 'pending';
