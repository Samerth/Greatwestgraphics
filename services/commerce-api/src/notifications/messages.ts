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
 * Only proof events produce mail today.
 *
 * Status changes are deliberately excluded: a proof decision already moves the
 * job, so notifying on both would send two emails for one action. Notifying on
 * status changes that a proof did not cause is worth doing, but needs a way to
 * tell the two apart first.
 */
export function notificationsForEvent(
  envelope: EventEnvelopeish,
  jobRequestId: string,
  context: NotificationContext,
): EmailMessage[] {
  const data = envelope.data ?? {};

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
