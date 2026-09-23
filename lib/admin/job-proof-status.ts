import type { Actor } from "@gwg/contracts";

export type ProofState = "not_uploaded" | "sent" | "needs_staff" | "approved" | "revision";

export interface ProofStateInfo {
  state: ProofState;
  label: string;
}

const STATE_LABELS: Record<ProofState, string> = {
  not_uploaded: "Not uploaded",
  sent: "Sent to customer",
  needs_staff: "Needs your review",
  approved: "Proof approved",
  revision: "Revision requested",
};

interface ProofLike {
  version: number;
  decision: "pending" | "approved" | "changes_requested" | null;
  decidedAt: string | null;
  decidedBy: Actor | null;
  decisionNote: string | null;
  awaitingDecisionFrom: "customer" | "staff" | null;
  note: string | null;
  createdAt: string;
}

/**
 * There is no explicit "not uploaded" or "sent" column anywhere — both are
 * derived, the first from the absence of any proof row and the second from
 * `awaitingDecisionFrom`, which records which party the round trip is
 * blocked on rather than a status word. This is the single place that
 * derivation happens, so the job page's badge and its "✓ PROOF APPROVED"
 * line (11-point admin note, point 6) read the same five states everywhere
 * they're shown.
 */
export function proofStateFor(proof: ProofLike | null): ProofStateInfo {
  if (!proof) return { state: "not_uploaded", label: STATE_LABELS.not_uploaded };
  if (proof.decision === "approved") {
    return { state: "approved", label: STATE_LABELS.approved };
  }
  if (proof.decision === "changes_requested") {
    return { state: "revision", label: STATE_LABELS.revision };
  }
  if (proof.awaitingDecisionFrom === "staff") {
    return { state: "needs_staff", label: STATE_LABELS.needs_staff };
  }
  // awaitingDecisionFrom === "customer", or legacy rows with neither set —
  // the safe default for an uploaded, undecided proof is "sent."
  return { state: "sent", label: STATE_LABELS.sent };
}

/** The newest-version-wins proof state for the whole job, plus the full
 *  version history (newest first) for the "versions are tracked" ask. */
export function summarizeJobProofs<T extends ProofLike>(
  proofs: readonly T[],
): { current: ProofStateInfo; versions: T[] } {
  const versions = [...proofs].sort((a, b) => b.version - a.version);
  return { current: proofStateFor(versions[0] ?? null), versions };
}
