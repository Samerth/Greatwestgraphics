/**
 * Turns commerce events into the emails they should produce.
 *
 * Kept free of database and network access so the mapping can be tested
 * directly. The dispatcher resolves recipients and hands them in.
 */

export interface NotificationContext {
  jobDisplayId: string;
  /** Null when the person row has no email; the message is then skipped
   * rather than sent to nobody. */
  customerEmail: string | null;
  staffEmail: string | null;
  siteBaseUrl: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

interface EventEnvelopeish {
  type?: string;
  data?: Record<string, unknown>;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function customerJobUrl(context: NotificationContext, jobId: string): string {
  return `${trimTrailingSlash(context.siteBaseUrl)}/portal/jobs/${jobId}`;
}

function staffJobUrl(context: NotificationContext, jobId: string): string {
  return `${trimTrailingSlash(context.siteBaseUrl)}/admin/jobs/${jobId}`;
}

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part != null && part !== "").join("\n");
}

/**
 * Submission, quote, proof, and invoice-request events produce mail today.
 *
 * Generic status changes are still excluded: a proof decision already moves
 * the job, so mapping both would send two emails for one action.
 */
export function notificationsForEvent(
  envelope: EventEnvelopeish,
  jobRequestId: string,
  context: NotificationContext,
): EmailMessage[] {
  const data = envelope.data ?? {};

  if (envelope.type === "commerce.job_request.submitted.v1") {
    const messages: EmailMessage[] = [];
    if (context.customerEmail) {
      messages.push({
        to: context.customerEmail,
        subject: `${context.jobDisplayId}: we received your job request`,
        text: lines(
          `Thanks — ${context.jobDisplayId} is in for design and pricing review.`,
          `\nTrack it here: ${customerJobUrl(context, jobRequestId)}`,
        ),
      });
    }
    if (context.staffEmail) {
      messages.push({
        to: context.staffEmail,
        subject: `${context.jobDisplayId}: new job submitted`,
        text: lines(
          `A customer submitted ${context.jobDisplayId}.`,
          `\nOpen the job: ${staffJobUrl(context, jobRequestId)}`,
        ),
      });
    }
    return messages;
  }

  if (envelope.type === "commerce.job_request.changes_responded.v1") {
    if (!context.staffEmail) return [];
    const note = typeof data.reason === "string" ? data.reason : null;
    return [
      {
        to: context.staffEmail,
        subject: `${context.jobDisplayId}: customer sent a revision`,
        text: lines(
          `The customer replied to requested changes on ${context.jobDisplayId}.`,
          note ? `\nWhat they said: ${note}` : null,
          `\nOpen the job: ${staffJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.invoice.issued.v1") {
    if (!context.customerEmail) return [];
    return [
      {
        to: context.customerEmail,
        subject: `${context.jobDisplayId}: your invoice is on the way`,
        text: lines(
          `We have issued the invoice for ${context.jobDisplayId}.`,
          `\nPayment instructions will arrive by email. Track the job: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.payment.recorded.v1") {
    if (!context.customerEmail) return [];
    return [
      {
        to: context.customerEmail,
        subject: `${context.jobDisplayId}: we received your payment`,
        text: lines(
          `Payment is recorded for ${context.jobDisplayId}. We will move the job into production next.`,
          `\nView the job: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.invoice.requested.v1") {
    if (!context.staffEmail) return [];
    const amountMinor =
      typeof data.amountMinor === "number" ? data.amountMinor : null;
    const currency = typeof data.currency === "string" ? data.currency : "CAD";
    const amount =
      amountMinor == null
        ? "the accepted quote"
        : new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency,
          }).format(amountMinor / 100);
    return [
      {
        to: context.staffEmail,
        subject: `${context.jobDisplayId}: customer requested an invoice`,
        text: lines(
          `The customer asked for a manual invoice for ${amount} on ${context.jobDisplayId}.`,
          `\nPrepare and send it: ${staffJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.final_quote.created.v1") {
    if (!context.customerEmail) return [];
    const amountMinor =
      typeof data.amountMinor === "number" ? data.amountMinor : null;
    const currency = typeof data.currency === "string" ? data.currency : "CAD";
    const amount =
      amountMinor == null
        ? "A final quote"
        : new Intl.NumberFormat("en-CA", {
            style: "currency",
            currency,
          }).format(amountMinor / 100);
    return [
      {
        to: context.customerEmail,
        subject: `${context.jobDisplayId}: your final quote is ready`,
        text: lines(
          `${amount} is ready for your review on ${context.jobDisplayId}.`,
          `\nReview and accept it: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.final_quote.accepted.v1") {
    if (!context.staffEmail) return [];
    return [
      {
        to: context.staffEmail,
        subject: `${context.jobDisplayId}: customer accepted the final quote`,
        text: lines(
          `The customer accepted final quote v${data.quoteVersion} on ${context.jobDisplayId}.`,
          `\nPrepare the invoice: ${staffJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.proof.created.v1") {
    const version = data.proofVersion;
    const note = typeof data.note === "string" ? data.note : null;

    if (data.awaitingDecisionFrom === "staff") {
      if (!context.staffEmail) return [];
      return [
        {
          to: context.staffEmail,
          subject: `${context.jobDisplayId}: customer submitted artwork for review`,
          text: lines(
            `A customer uploaded artwork on ${context.jobDisplayId} (proof v${version}).`,
            note ? `\nTheir note: ${note}` : null,
            `\nReview it: ${staffJobUrl(context, jobRequestId)}`,
          ),
        },
      ];
    }

    if (!context.customerEmail) return [];
    return [
      {
        to: context.customerEmail,
        subject: `${context.jobDisplayId}: your proof is ready to approve`,
        text: lines(
          `We have posted proof v${version} on ${context.jobDisplayId} for your approval.`,
          note ? `\nNote from our art team: ${note}` : null,
          `\nApprove it or ask for changes: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.proof.decided.v1") {
    const version = data.proofVersion;
    const approved = data.decision === "approved";
    const note = typeof data.note === "string" ? data.note : null;

    // The mail goes to whoever was *not* the decider: the decision is news to
    // the other side of the table.
    if (data.decidedBy === "customer") {
      if (!context.staffEmail) return [];
      return [
        {
          to: context.staffEmail,
          subject: approved
            ? `${context.jobDisplayId}: customer approved proof v${version}`
            : `${context.jobDisplayId}: customer requested changes on proof v${version}`,
          text: lines(
            approved
              ? `The customer approved proof v${version} on ${context.jobDisplayId}.`
              : `The customer asked for changes to proof v${version} on ${context.jobDisplayId}.`,
            note ? `\nWhat they said: ${note}` : null,
            `\nOpen the job: ${staffJobUrl(context, jobRequestId)}`,
          ),
        },
      ];
    }

    if (!context.customerEmail) return [];
    return [
      {
        to: context.customerEmail,
        subject: approved
          ? `${context.jobDisplayId}: your artwork was approved`
          : `${context.jobDisplayId}: we need a change to your artwork`,
        text: lines(
          approved
            ? `Our art team approved proof v${version} on ${context.jobDisplayId}.`
            : `Our art team has asked for a change to proof v${version} on ${context.jobDisplayId}.`,
          note ? `\nDetails: ${note}` : null,
          `\nView the job: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  if (envelope.type === "commerce.job_request.status_changed.v1") {
    const toStatus = typeof data.toStatus === "string" ? data.toStatus : null;
    const reason = typeof data.reason === "string" ? data.reason : null;
    // Staff can uncheck "Email the customer" on a transition to suppress this
    // one email without touching the job's status history. Absent (older
    // events, or any other caller) defaults to notifying, same as everything
    // else in this file.
    const notifyCustomer = data.notifyCustomer !== false;
    if (!toStatus || !notifyCustomer || !context.customerEmail) return [];

    const copy: Partial<Record<string, { subject: string; body: string }>> = {
      ready_for_production: {
        subject: `${context.jobDisplayId}: your order is queued for production`,
        body: "Design and payment are complete. Your order is queued and production will start once the studio releases it.",
      },
      in_production: {
        subject: `${context.jobDisplayId}: your order is in production`,
        body: "Your order is now in production. No action is needed — we will update you when it is ready.",
      },
      ready_for_pickup: {
        subject: `${context.jobDisplayId}: ready for pickup`,
        body: "Your order is ready for pickup at our Vancouver studio.",
      },
      shipped: {
        subject: `${context.jobDisplayId}: your order has shipped`,
        body: "Your order has shipped and is on its way.",
      },
      completed: {
        subject: `${context.jobDisplayId}: order complete`,
        body: "Your order is complete. Thank you for choosing Great West Graphics.",
      },
      rejected: {
        subject: `${context.jobDisplayId}: we are unable to proceed`,
        body: "We are unable to proceed with this job request as submitted.",
      },
      cancelled: {
        subject: `${context.jobDisplayId}: request cancelled`,
        body: "This job request has been cancelled.",
      },
    };

    const entry = copy[toStatus];
    if (!entry) return [];

    return [
      {
        to: context.customerEmail,
        subject: entry.subject,
        text: lines(
          entry.body,
          reason ? `\n${reason}` : null,
          `\nView the job: ${customerJobUrl(context, jobRequestId)}`,
        ),
      },
    ];
  }

  return [];
}

/**
 * How long to wait before retrying a failed send.
 *
 * Exponential with a ceiling, so a transient Resend outage backs off quickly
 * but a persistent failure still retries a few times an hour rather than
 * hammering the API or going silent.
 */
export const BACKOFF_BASE_SECONDS = 30;
export const BACKOFF_CEILING_SECONDS = 30 * 60;

export function backoffSeconds(attempts: number): number {
  return Math.min(
    BACKOFF_CEILING_SECONDS,
    BACKOFF_BASE_SECONDS * 2 ** Math.max(0, attempts - 1),
  );
}
