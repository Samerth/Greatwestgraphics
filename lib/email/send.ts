import { Resend } from "resend";

/**
 * Raised when no API key is configured and the caller is somewhere that a
 * logged-and-dropped email would be a lie.
 *
 * The commerce API already draws this distinction (see
 * `services/commerce-api/src/notifications/email.ts`): an unconfigured mailer
 * that reports success is worse than one that fails, because the failure is the
 * only signal anyone gets that mail is not going out.
 */
export class EmailNotConfiguredError extends Error {
  readonly code = "EMAIL_NOT_CONFIGURED";
}

/** Raised when Resend accepted the request but refused the message. */
export class EmailSendError extends Error {
  readonly code = "EMAIL_SEND_FAILED";
}

/**
 * The verified sending identity for the site.
 *
 * Resend's shared `onboarding@resend.dev` was the old default. It only delivers
 * to the Resend account owner, so every customer-facing message sent through it
 * is silently discarded — fine for the contact form, which happens to mail the
 * owner, and useless for proofs.
 */
export const DEFAULT_FROM_EMAIL =
  "Great West Graphics <noreply@greatwestgraphics.com>";

/**
 * Sends via Resend.
 *
 * Outside production a missing API key logs the message instead, which keeps
 * local development workable without credentials. In production it throws:
 * there is no useful sense in which a logged email was sent, and the callers
 * here turn a thrown error into a visible failure for the customer.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    options.from || process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new EmailNotConfiguredError(
        `RESEND_API_KEY is not set; refusing to report a delivered message to ${options.to}`,
      );
    }
    console.log(`[email] RESEND_API_KEY not set — logging instead of sending to ${options.to}.`);
    console.log(`Subject: ${options.subject}\n\n${options.text}`);
    return { sent: false };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
  // An unverified sending domain arrives here, not as a transport error, so
  // this is the branch that catches the launch-blocking misconfiguration.
  if (error) {
    throw new EmailSendError(error.message || "Email send failed");
  }
  return { sent: true };
}
