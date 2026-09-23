import {
  JobRequestStatuses,
  type JobRequestStatus,
} from "@gwg/contracts";

/** How a status should read at a glance, before anyone parses the words.
 *
 *  Kept here rather than in the admin page because the staff inbox, the job
 *  page and the customer portal all read `jobStatusPresentation` — three
 *  screens disagreeing about whether "payment failed" is alarming would be
 *  its own bug. `tone` is required on the interface, so a status added later
 *  without one is a compile error rather than a silently colourless badge. */
export type StatusTone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

export interface JobStatusPresentation {
  label: string;
  nextAction: string;
  paymentReady: boolean;
  tone: StatusTone;
}

export const jobStatusPresentation: Record<
  JobRequestStatus,
  JobStatusPresentation
> = {
  draft: {
    label: "Draft",
    nextAction: "Finish and submit this request.",
    tone: "neutral",
    paymentReady: false,
  },
  submitted: {
    label: "Submitted",
    nextAction: "Our team will begin the design and pricing review.",
    tone: "info",
    paymentReady: false,
  },
  under_review: {
    label: "Under review",
    nextAction: "No action is needed while our team reviews the job.",
    tone: "info",
    paymentReady: false,
  },
  changes_requested: {
    label: "Changes requested",
    nextAction: "Reply with the revision so we can continue the review.",
    tone: "warning",
    paymentReady: false,
  },
  rejected: {
    label: "Unable to proceed",
    nextAction: "Contact our team to discuss alternatives.",
    tone: "danger",
    paymentReady: false,
  },
  approved: {
    label: "Design approved",
    nextAction: "Review and accept the final quote when it is posted.",
    tone: "progress",
    paymentReady: false,
  },
  awaiting_payment: {
    label: "Payment ready",
    nextAction: "Request an invoice. We will send payment instructions.",
    tone: "warning",
    paymentReady: true,
  },
  payment_pending: {
    label: "Payment processing",
    nextAction: "Wait for payment confirmation.",
    tone: "progress",
    paymentReady: false,
  },
  payment_failed: {
    label: "Payment needs attention",
    nextAction: "Request the invoice again or contact the studio.",
    tone: "danger",
    paymentReady: true,
  },
  paid: {
    label: "Paid",
    nextAction: "Our team will release the approved job to production.",
    tone: "success",
    paymentReady: false,
  },
  ready_for_production: {
    label: "Ready for production",
    nextAction: "Production will start once the studio releases the job.",
    tone: "progress",
    paymentReady: false,
  },
  in_production: {
    label: "In production",
    nextAction: "No action is needed. We will update you when it is ready.",
    tone: "progress",
    paymentReady: false,
  },
  ready_for_pickup: {
    label: "Ready for pickup",
    nextAction: "Your order is ready at our Vancouver studio.",
    tone: "success",
    paymentReady: false,
  },
  shipped: {
    label: "Shipped",
    nextAction: "Your order is on the way.",
    tone: "success",
    paymentReady: false,
  },
  completed: {
    label: "Completed",
    nextAction: "This order is complete.",
    tone: "success",
    paymentReady: false,
  },
  cancelled: {
    label: "Cancelled",
    nextAction: "This request was cancelled. Contact us if you need a new one.",
    tone: "danger",
    paymentReady: false,
  },
};

export function hasPresentationForEveryStatus(): boolean {
  return JobRequestStatuses.every((status) => jobStatusPresentation[status]);
}
