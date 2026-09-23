import {
  JobRequestStatuses,
  validNextStatuses,
  type JobRequestStatus,
} from "@gwg/contracts";
import type { TrackStage } from "@/components/ui/ProgressTrack";

/**
 * The client's own mental model of an order (11-point admin note, point 2):
 * Submitted → Under Review → Awaiting Proof Approval → Approved →
 * In Production → Ready for Pickup/Shipped → Completed, with Cancelled
 * available throughout.
 *
 * The system underneath runs on 16 statuses because they also drive
 * customer emails, the payment flow and the customer portal — none of that
 * changes here. This file only maps those 16 onto the 7 stages the client
 * actually thinks in, for display.
 */
export const JOB_PIPELINE_STAGES = [
  "Submitted",
  "Under Review",
  "Awaiting Proof Approval",
  "Approved",
  "In Production",
  "Ready / Shipped",
  "Completed",
] as const;

type PipelineStage = (typeof JOB_PIPELINE_STAGES)[number];

/** Every status that stays on the track, mapped to its stage and an
 *  optional detail shown under the stage label. `rejected` and `cancelled`
 *  are handled separately — see `jobPipelineState` — because a job that has
 *  left the pipeline is not "stuck early," it is off the track entirely. */
const STAGE_BY_STATUS: Record<
  Exclude<JobRequestStatus, "rejected" | "cancelled">,
  { stage: PipelineStage; detail?: string }
> = {
  draft: { stage: "Submitted", detail: "not yet submitted" },
  submitted: { stage: "Submitted" },
  under_review: { stage: "Under Review" },
  changes_requested: { stage: "Under Review", detail: "changes requested" },
  approved: { stage: "Approved" },
  awaiting_payment: { stage: "Approved", detail: "awaiting payment" },
  payment_pending: { stage: "Approved", detail: "payment processing" },
  payment_failed: { stage: "Approved", detail: "payment needs attention" },
  paid: { stage: "Approved", detail: "paid" },
  ready_for_production: { stage: "In Production", detail: "queued" },
  in_production: { stage: "In Production" },
  ready_for_pickup: { stage: "Ready / Shipped" },
  shipped: { stage: "Ready / Shipped" },
  completed: { stage: "Completed" },
};

export interface JobPipelineInput {
  status: JobRequestStatus;
  /** True while a proof is uploaded and the round trip is waiting on the
   *  *customer* — `proof_versions.awaiting_decision_from === "customer"`.
   *  Proof approval has no status of its own in the real state machine; it
   *  lives entirely in this flag, which is exactly why the client believes
   *  "Awaiting Proof Approval" is a stage — from where they sit, it is one. */
  awaitingCustomerProof: boolean;
  /** True once the latest proof has been approved, so stage 2 can show as
   *  done rather than current once the job has moved on. */
  proofApproved: boolean;
}

export interface JobPipelineState {
  stages: TrackStage[];
  /** Set only for a job that has left the pipeline — cancelled or rejected.
   *  When set, the caller should show this instead of the stage track. */
  offTrack: { label: string; tone: "danger" } | null;
}

/** Turns the real 16-status job into the client's 7-stage story. */
export function jobPipelineState(input: JobPipelineInput): JobPipelineState {
  if (input.status === "cancelled") {
    return { stages: [], offTrack: { label: "Cancelled", tone: "danger" } };
  }
  if (input.status === "rejected") {
    return { stages: [], offTrack: { label: "Unable to proceed", tone: "danger" } };
  }

  const mapped = STAGE_BY_STATUS[input.status];
  const currentIndex = input.awaitingCustomerProof
    ? JOB_PIPELINE_STAGES.indexOf("Awaiting Proof Approval")
    : JOB_PIPELINE_STAGES.indexOf(mapped.stage);

  const stages: TrackStage[] = JOB_PIPELINE_STAGES.map((label, index) => {
    if (label === "Awaiting Proof Approval") {
      const state = input.awaitingCustomerProof
        ? "current"
        : index < currentIndex || input.proofApproved
          ? "done"
          : "upcoming";
      return { label, state };
    }
    const state =
      index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
    return {
      label,
      state,
      detail: index === currentIndex && !input.awaitingCustomerProof ? mapped.detail : null,
    };
  });

  return { stages, offTrack: null };
}

/**
 * Which statuses staff should actually be offered next, on top of the raw
 * transition graph — moved byte-for-byte out of the admin job page so it
 * can carry its own test. Filters `shipped` off a pickup job and
 * `ready_for_pickup` off a shipping job, since offering either the wrong
 * fulfilment status has no legitimate next step.
 */
export function staffNextStatuses(
  status: JobRequestStatus,
  method?: string,
): readonly JobRequestStatus[] {
  const next = validNextStatuses(status);
  if (status !== "in_production") return next;
  if (method === "pickup") {
    return next.filter((value) => value !== "shipped");
  }
  if (method && method !== "pickup") {
    return next.filter((value) => value !== "ready_for_pickup");
  }
  return next;
}

/** Every real status must land on a pipeline stage or the off-track branch
 *  — used by the test suite so a 17th status added later cannot silently
 *  fall through with no stage at all. */
export function everyStatusHasAPipelineOutcome(): boolean {
  return JobRequestStatuses.every((status) => {
    if (status === "cancelled" || status === "rejected") return true;
    return status in STAGE_BY_STATUS;
  });
}
