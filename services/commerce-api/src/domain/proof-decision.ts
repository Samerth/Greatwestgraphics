import type {
  Actor,
  JobRequestStatus,
  ProofAudience,
  ProofDecision,
} from "@gwg/contracts";

/** Raised when a proof decision is refused: already decided, missing the
 * required note, or coming from the party that is not being waited on. */
export class ProofDecisionError extends Error {
  readonly code = "PROOF_DECISION_REJECTED";
}

/** The parts of a stored proof the rules below care about. Keeping this
 * structural rather than importing the Drizzle row type is what lets these
 * rules be exercised without a database. */
export interface DecidableProof {
  version: number;
  decision: string | null;
  awaitingDecisionFrom: string | null;
}

/** Staff, system and integration actors all act on the shop's behalf; only a
 * customer actor sits on the customer side of a proof. */
export function audienceForActor(actor: Actor): ProofAudience {
  return actor.type === "customer" ? "customer" : "staff";
}

/** The audience a newly raised proof should be aimed at: the other party. */
export function defaultAudienceForAuthor(actor: Actor): ProofAudience {
  return audienceForActor(actor) === "customer" ? "staff" : "customer";
}

/**
 * Decides whether `actor` may record `decision` against `proof`.
 *
 * Three things are checked, in the order that produces the most useful message:
 * a proof is decided once and only once; asking for changes has to say what to
 * change; and the verdict has to come from the party being waited on — without
 * that last rule a customer could approve their own artwork past staff review.
 */
export function assertProofDecidable(
  proof: DecidableProof,
  decision: ProofDecision,
  note: string | undefined,
  actor: Actor,
): void {
  if (proof.decision && proof.decision !== "pending") {
    throw new ProofDecisionError(
      `Proof version ${proof.version} was already ${proof.decision}`,
    );
  }

  if (decision === "changes_requested" && !note?.trim()) {
    throw new ProofDecisionError("A note is required when requesting changes");
  }

  // Rows written before proofs carried an audience were all staff proofs
  // awaiting the customer, which is the only path the admin UI offered.
  const expected: ProofAudience =
    proof.awaitingDecisionFrom === "staff" ? "staff" : "customer";
  if (audienceForActor(actor) !== expected) {
    throw new ProofDecisionError(
      `Proof version ${proof.version} is awaiting a decision from ${expected}`,
    );
  }
}

/**
 * The job status a decision should drive the request to, or null to leave it
 * alone.
 *
 * Only `under_review` reacts. Every other state — paid, rejected, already in
 * production — has a stronger claim on the job than a proof comment that
 * arrives late, and silently rewinding one of those would be worse than
 * recording the decision on its own.
 */
export function statusForProofDecision(
  current: JobRequestStatus,
  decision: ProofDecision,
): JobRequestStatus | null {
  if (current !== "under_review") return null;
  return decision === "approved" ? "approved" : "changes_requested";
}
