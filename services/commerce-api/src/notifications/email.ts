import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { EmailMessage } from "./messages.js";

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class EmailNotConfiguredError extends Error {
  readonly code = "EMAIL_NOT_CONFIGURED";
}

/**
 * Sends through Resend's REST API directly rather than the `resend` package.
 *
 * The API image only needs one HTTP call, and Node has fetch built in, so a
 * dependency here would be weight in the container for no gain.
 */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      // Resend puts the useful part in the body; the status alone does not say
      // whether this is a bad key, an unverified domain, or a rate limit.
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Resend rejected the message (${response.status}): ${detail.slice(0, 500)}`,
      );
    }
  }
}

/**
 * Sends through Amazon SES v2.
 *
 * Region and credentials are picked up by the SDK's default provider chain
 * (env vars, shared config file, or an attached IAM role) — this class only
 * needs the region explicitly, since the SDK client requires it up front.
 */
export class SesEmailSender implements EmailSender {
  private readonly client: SESv2Client;

  constructor(
    region: string,
    private readonly from: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.from,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: "UTF-8" },
              Body: { Text: { Data: message.text, Charset: "UTF-8" } },
            },
          },
        }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`SES rejected the message: ${detail}`);
    }
  }
}

/**
 * Used when no sender is configured.
 *
 * It throws rather than logging and reporting success. A dispatcher that
 * treated an unconfigured mailer as a successful send would mark events
 * published and lose them; failing keeps them queued until email is wired up.
 */
export class UnconfiguredEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    throw new EmailNotConfiguredError(
      `AWS_REGION is not set; cannot notify ${message.to}`,
    );
  }
}
