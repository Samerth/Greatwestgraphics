import { Resend } from "resend";

/** Sends via Resend when configured; otherwise logs — same fallback used for the contact form. */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    options.from ||
    process.env.CONTACT_FROM_EMAIL ||
    "Great West Graphics <onboarding@resend.dev>";

  if (!apiKey) {
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
  if (error) throw new Error(error.message || "Email send failed");
  return { sent: true };
}
