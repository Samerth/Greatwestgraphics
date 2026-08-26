import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * Raised when no region is configured and the caller is somewhere that a
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

/** Raised when SES accepted the request but refused the message. */
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
 * Sends via Amazon SES v2.
 *
 * Outside production a missing region logs the message instead, which keeps
 * local development workable without credentials. In production it throws:
 * there is no useful sense in which a logged email was sent, and the callers
 * here turn a thrown error into a visible failure for the customer.
 *
 * Region and credentials are resolved by the AWS SDK's default provider
 * chain (env vars, shared config, or an attached IAM role) — nothing here
 * reads AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY directly.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const region = process.env.AWS_REGION;
  const from =
    options.from || process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!region) {
    if (process.env.NODE_ENV === "production") {
      throw new EmailNotConfiguredError(
        `AWS_REGION is not set; refusing to report a delivered message to ${options.to}`,
      );
    }
    console.log(`[email] AWS_REGION not set — logging instead of sending to ${options.to}.`);
    console.log(`Subject: ${options.subject}\n\n${options.text}`);
    return { sent: false };
  }

  const client = new SESv2Client({ region });
  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [options.to] },
        ...(options.replyTo ? { ReplyToAddresses: [options.replyTo] } : {}),
        Content: {
          Simple: {
            Subject: { Data: options.subject, Charset: "UTF-8" },
            Body: { Text: { Data: options.text, Charset: "UTF-8" } },
          },
        },
      }),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email send failed";
    throw new EmailSendError(detail);
  }
  return { sent: true };
}
