import type { JobRequestStatus } from "@gwg/contracts";

/**
 * The customer's view of where their order has got to (CodSphere UAT V2 row
 * 55). Five stages, in the words the client asked for — deliberately coarser
 * than the sixteen internal statuses, because a customer does not need to
 * distinguish "payment pending" from "paid" to know the job is past proofing
 * and not yet on a press.
 *
 * The precise, current instruction always comes from `portalNextAction`
 * below. This is the map; that is the compass.
 */
export const PORTAL_STAGES = [
  "Order Submitted",
  "Artwork Review",
  "Proof Approval",
  "Production",
  "Ready / Shipped",
] as const;

export type PortalStage = (typeof PORTAL_STAGES)[number];

/** -1 for a job that left the happy path; the tracker is hidden for those. */
export function portalStageIndex(status: JobRequestStatus): number {
  switch (status) {
    case "draft":
    case "submitted":
      return 0;
    case "under_review":
    case "changes_requested":
      return 1;
    // Everything between design approval and the press sits at Proof
    // Approval. Payment happens in this band, and the next-action panel says
    // so explicitly — the tracker just shows the job is past the artwork.
    case "approved":
    case "awaiting_payment":
    case "payment_pending":
    case "payment_failed":
    case "paid":
      return 2;
    case "ready_for_production":
    case "in_production":
      return 3;
    case "ready_for_pickup":
    case "shipped":
    case "completed":
      return 4;
    case "rejected":
    case "cancelled":
      return -1;
  }
}

export type StageState = "done" | "current" | "upcoming";

export function portalStageStates(
  status: JobRequestStatus,
): { stage: PortalStage; state: StageState }[] {
  const current = portalStageIndex(status);
  return PORTAL_STAGES.map((stage, index) => ({
    stage,
    state:
      current < 0 || index > current
        ? "upcoming"
        : index === current
          ? "current"
          : "done",
  }));
}

/**
 * Whether the customer is being waited on, and for what.
 *
 * The client's ask was that this be unmistakable: "This makes it immediately
 * obvious whether GWG or the customer needs to do something." So it is
 * derived from what is actually outstanding, not from the status label alone
 * — a job can read "Submitted" and still have a proof sitting in front of the
 * customer.
 */
export type PortalAction = {
  required: boolean;
  title: string;
  body: string;
};

export function portalNextAction(input: {
  status: JobRequestStatus;
  /** A proof is posted and the customer is the one who has to decide. */
  awaitingProofDecision: boolean;
  /** A final quote is posted that they have not accepted yet. */
  hasUnacceptedQuote: boolean;
  quoteAccepted: boolean;
  alreadyPaid: boolean;
  invoiceRequested: boolean;
}): PortalAction {
  // Ordered by what is actually in front of the customer, most immediate
  // first — not by status, because several can be true at once.
  if (input.awaitingProofDecision) {
    return {
      required: true,
      title: "Please review your proof",
      body: "Review the artwork below and either approve it for production or request changes.",
    };
  }
  if (input.status === "changes_requested") {
    return {
      required: true,
      title: "We need a reply from you",
      body: "Our team has asked a question about this order. Reply below so we can carry on.",
    };
  }
  if (input.hasUnacceptedQuote && !input.quoteAccepted) {
    return {
      required: true,
      title: "Your final quote is ready",
      body: "Review the pricing below and accept it so we can move your order forward.",
    };
  }
  if (input.status === "payment_failed") {
    return {
      required: true,
      title: "Payment needs attention",
      body: "The last payment attempt did not complete. Try again, or request an invoice instead.",
    };
  }
  if (input.quoteAccepted && !input.alreadyPaid && !input.invoiceRequested) {
    return {
      required: true,
      title: "Payment is ready when you are",
      body: "Pay by card, or request an invoice and we will send payment instructions.",
    };
  }
  if (input.status === "rejected") {
    return {
      required: true,
      title: "We could not proceed with this order",
      body: "Please get in touch and we will go through the alternatives with you.",
    };
  }

  // Nothing outstanding on their side — say which of ours they are waiting on.
  const waiting: Partial<Record<JobRequestStatus, string>> = {
    draft: "This order has not been submitted yet.",
    submitted: "Our team is picking up your order and starting the review.",
    under_review: "Our team is reviewing your artwork, quantities and availability.",
    approved: "Your design is approved. We are preparing your final pricing.",
    awaiting_payment: "We are getting your invoice ready.",
    payment_pending: "We are confirming your payment.",
    paid: "Payment received. We are releasing your order to production.",
    ready_for_production: "Your order is queued and will start production shortly.",
    in_production: "Your order is being printed.",
    ready_for_pickup: "Your order is ready to collect from our Vancouver studio.",
    shipped: "Your order is on its way.",
    completed: "This order is complete. Thank you.",
    cancelled: "This order was cancelled. Get in touch if you need a new one.",
  };

  return {
    required: false,
    title: "No action required",
    body: waiting[input.status] ?? "Our team is working on your order.",
  };
}

/**
 * The timeline the client sketched: the five stages, each either done with a
 * date, current, or still to come — rather than a list of internal status
 * transitions with timestamps.
 */
export type PortalTimelineEntry = {
  stage: PortalStage;
  state: StageState;
  /** ISO timestamp of the first transition that reached this stage. */
  occurredAt: string | null;
};

export function portalTimeline(
  status: JobRequestStatus,
  history: readonly { toStatus: JobRequestStatus; occurredAt: string }[],
): PortalTimelineEntry[] {
  const earliest = new Map<number, string>();
  // Sorted so an out-of-order history still yields the first time a stage
  // was reached rather than whichever row happened to come back first.
  const ordered = [...history].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  for (const entry of ordered) {
    const index = portalStageIndex(entry.toStatus);
    if (index < 0) continue;
    if (!earliest.has(index)) earliest.set(index, entry.occurredAt);
  }

  return portalStageStates(status).map(({ stage, state }, index) => ({
    stage,
    state,
    occurredAt: state === "upcoming" ? null : (earliest.get(index) ?? null),
  }));
}

/** `2026-09-09T21:45:00Z` → `Sept 9, 2026`, in the reader's own timezone. */
export function formatPortalDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `Sept 9, 2026 at 2:45 PM` — used where an approval is being recorded. */
export function formatPortalDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const date = formatPortalDate(iso);
  const time = parsed.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}

/** Shown beside the approve control, so nobody approves on autopilot. */
export const PROOF_APPROVAL_WARNING =
  "By approving this proof, you confirm that the artwork, spelling, colours, placement and product details are correct and authorize GWG to proceed with production.";

/**
 * A plain-language decoration line for the customer's own order summary
 * (row 55, point 3: "Decoration method, Decoration location").
 *
 * Read defensively out of the immutable pricing snapshot, which is the only
 * place the order records what was actually quoted. Snapshots come in two
 * schema versions and older lines may carry none at all, so anything missing
 * simply yields nothing rather than a broken row.
 */
export type PortalDecoration = {
  method: string;
  location: string;
  detail: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  screen: "Screen Print",
  screenprint: "Screen Print",
  screen_print: "Screen Print",
  embroidery: "Embroidery",
  dtf: "DTF Transfer",
  dtg: "Direct to Garment",
  sublimation: "Sublimation",
  vinyl: "Heat Transfer Vinyl",
};

const LOCATION_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Left Sleeve",
  right: "Right Sleeve",
};

export function portalDecorationLabel(methodKey: string): string {
  const key = methodKey.trim().toLowerCase();
  return METHOD_LABELS[key] ?? methodKey.trim();
}

export function portalLocationLabel(location: string): string {
  const key = location.trim().toLowerCase();
  return LOCATION_LABELS[key] ?? location.trim();
}

export function portalDecorations(snapshot: unknown): PortalDecoration[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const input = (snapshot as { input?: unknown }).input;
  if (!input || typeof input !== "object") return [];
  const lines = (input as { decorations?: unknown }).decorations;
  if (!Array.isArray(lines)) return [];

  const seen = new Set<string>();
  const result: PortalDecoration[] = [];
  for (const line of lines) {
    if (!line || typeof line !== "object") continue;
    const entry = line as {
      methodKey?: unknown;
      location?: unknown;
      colours?: unknown;
      optionKey?: unknown;
    };
    if (typeof entry.methodKey !== "string" || typeof entry.location !== "string") {
      continue;
    }
    const method = portalDecorationLabel(entry.methodKey);
    const location = portalLocationLabel(entry.location);
    // One line per location+method: the same pair repeated is the pricing
    // engine's business, not something a customer needs to read twice.
    const key = `${method}|${location}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const colours =
      typeof entry.colours === "number" && entry.colours > 0
        ? `${entry.colours} ${entry.colours === 1 ? "colour" : "colours"}`
        : null;
    const option =
      typeof entry.optionKey === "string" && entry.optionKey.trim()
        ? entry.optionKey.trim()
        : null;
    result.push({ method, location, detail: colours ?? option });
  }
  return result;
}
