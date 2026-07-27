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
    nextAction: "Review the requested changes with our studio team.",
    paymentReady: false,
  },
  rejected: {
    label: "Unable to proceed",
    nextAction: "Contact our team to discuss alternatives.",
    paymentReady: false,
  },
  approved: {
    label: "Design approved",
    nextAction: "We are preparing the final payment amount.",
    paymentReady: false,
  },
  awaiting_payment: {
    label: "Payment ready",
    nextAction: "Payment will be available here when Stripe is connected.",
    paymentReady: true,
  },
  payment_pending: {
    label: "Payment processing",
    nextAction: "Wait for payment confirmation.",
    paymentReady: false,
  },
  payment_failed: {
    label: "Payment needs attention",
    nextAction: "Retry payment after the payment integration is available.",
    paymentReady: true,
  },
  paid: {
    label: "Paid",
    nextAction: "Our team will release the approved job to production.",
    paymentReady: false,
  },
  ready_for_production: {
    label: "Ready for production",
    nextAction: "No action is needed. Production updates will follow.",
    paymentReady: false,
  },
};

export function hasPresentationForEveryStatus(): boolean {
  return JobRequestStatuses.every((status) => jobStatusPresentation[status]);
}
