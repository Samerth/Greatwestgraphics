import type { JobRequestStatus } from "@gwg/contracts";

export class InvalidJobRequestTransitionError extends Error {
  readonly code = "INVALID_JOB_REQUEST_TRANSITION";

  constructor(
    readonly from: JobRequestStatus,
    readonly to: JobRequestStatus,
  ) {
    super(`Cannot transition job request from ${from} to ${to}`);
  }
}

const transitions = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected"],
  under_review: ["changes_requested", "rejected", "approved"],
  changes_requested: ["submitted", "rejected"],
  rejected: [],
  approved: ["awaiting_payment"],
  awaiting_payment: ["payment_pending"],
  payment_pending: ["payment_failed", "paid"],
  payment_failed: ["payment_pending"],
  paid: ["ready_for_production"],
  ready_for_production: [],
} satisfies Record<JobRequestStatus, readonly JobRequestStatus[]>;

export function validNextStatuses(
  status: JobRequestStatus,
): readonly JobRequestStatus[] {
  return transitions[status];
}

export function assertJobRequestTransition(
  from: JobRequestStatus,
  to: JobRequestStatus,
): void {
  if (!transitions[from].includes(to as never)) {
    throw new InvalidJobRequestTransitionError(from, to);
  }
}
