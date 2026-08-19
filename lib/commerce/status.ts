import {
  JobRequestStatuses,
  type JobRequestStatus,
} from "@gwg/contracts";

export interface JobStatusPresentation {
  label: string;
  nextAction: string;
  paymentReady: boolean;
}

export const jobStatusPresentation: Record<
  JobRequestStatus,
  JobStatusPresentation
> = {
  draft: {
    label: "Draft",
    nextAction: "Finish and submit this request.",
    paymentReady: false,
  },
  submitted: {
    label: "Submitted",
    nextAction: "Our team will begin the design and pricing review.",
    paymentReady: false,
  },
  under_review: {
    label: "Under review",
    nextAction: "No action is needed while our team reviews the job.",
    paymentReady: false,
  },
  changes_requested: {
    label: "Changes requested",
    nextAction: "Reply with the revision so we can continue the review.",
    paymentReady: false,
  },
  rejected: {
    label: "Unable to proceed",
    nextAction: "Contact our team to discuss alternatives.",
    paymentReady: false,
  },
  approved: {
    label: "Design approved",
    nextAction: "Review and accept the final quote when it is posted.",
    paymentReady: false,
  },
  awaiting_payment: {
    label: "Payment ready",
    nextAction: "Request an invoice. We will send payment instructions.",
    paymentReady: true,
  },
  payment_pending: {
    label: "Payment processing",
    nextAction: "Wait for payment confirmation.",
    paymentReady: false,
  },
  payment_failed: {
    label: "Payment needs attention",
    nextAction: "Request the invoice again or contact the studio.",
    paymentReady: true,
  },
  paid: {
    label: "Paid",
    nextAction: "Our team will release the approved job to production.",
    paymentReady: false,
  },
  ready_for_production: {
    label: "Ready for production",
    nextAction: "Production will start once the studio releases the job.",
    paymentReady: false,
  },
  in_production: {
    label: "In production",
    nextAction: "No action is needed. We will update you when it is ready.",
    paymentReady: false,
  },
  ready_for_pickup: {
    label: "Ready for pickup",
    nextAction: "Your order is ready at our Vancouver studio.",
    paymentReady: false,
  },
  shipped: {
    label: "Shipped",
    nextAction: "Your order is on the way.",
    paymentReady: false,
  },
  completed: {
    label: "Completed",
    nextAction: "This order is complete.",
    paymentReady: false,
  },
  cancelled: {
    label: "Cancelled",
    nextAction: "This request was cancelled. Contact us if you need a new one.",
    paymentReady: false,
  },
};

export function hasPresentationForEveryStatus(): boolean {
  return JobRequestStatuses.every((status) => jobStatusPresentation[status]);
}
