import {
  JobRequestTransitions,
  validNextStatuses as sharedValidNextStatuses,
  type JobRequestStatus,
} from "@gwg/contracts";

export class InvalidJobRequestTransitionError extends Error {
  readonly code = "INVALID_JOB_REQUEST_TRANSITION";

  constructor(
    readonly from: JobRequestStatus,
    readonly to: JobRequestStatus,
  ) {
    super(`Cannot transition job request from ${from} to ${to}`);
  }
}

export function validNextStatuses(
  status: JobRequestStatus,
): readonly JobRequestStatus[] {
  return sharedValidNextStatuses(status);
}

export function assertJobRequestTransition(
  from: JobRequestStatus,
  to: JobRequestStatus,
): void {
  if (!JobRequestTransitions[from].includes(to as never)) {
    throw new InvalidJobRequestTransitionError(from, to);
  }
}
