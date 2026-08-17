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
 * Used when no API key is configured.
 *
 * It throws rather than logging and reporting success. A dispatcher that
 * treated an unconfigured mailer as a successful send would mark events
 * published and lose them; failing keeps them queued until email is wired up.
 */
export class UnconfiguredEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    throw new EmailNotConfiguredError(
      `RESEND_API_KEY is not set; cannot notify ${message.to}`,
    );
  }
}
