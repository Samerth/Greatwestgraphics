import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  EmailNotConfiguredError,
  EmailSendError,
  sendEmail,
} from "@/lib/email/send";

const ContactSubmissionSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  topic: z.string().max(200).optional(),
  details: z.string().min(1).max(4_000),
});

export async function POST(request: Request) {
  try {
    const submission = ContactSubmissionSchema.parse(await request.json());
    const toEmail = process.env.CONTACT_TO_EMAIL || "info@greatwestgraphics.com";

    const subject = `New contact form: ${submission.topic || "General inquiry"} — ${submission.name}`;
    const body = [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      submission.phone ? `Phone: ${submission.phone}` : null,
      submission.company ? `Company: ${submission.company}` : null,
      submission.topic ? `Topic: ${submission.topic}` : null,
      "",
      submission.details,
    ]
      .filter((line) => line !== null)
      .join("\n");

    // Shared with the invite mailer rather than talking to Resend directly, so
    // the from-address default and the failure semantics only exist in one place.
    const { sent } = await sendEmail({
      to: toEmail,
      replyTo: submission.email,
      subject,
      text: body,
    });

    // Only reachable outside production, where sendEmail logs instead of
    // sending. The status is reported honestly so a developer can tell the
    // difference; the form treats any 2xx as delivered.
    return NextResponse.json({ status: sent ? "sent" : "logged" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues.map((issue) => issue.message).join("; "),
          },
        },
        { status: 400 },
      );
    }
    // Email being unconfigured is an operator problem, and the customer's
    // message is gone either way. Telling them so beats a false confirmation:
    // they can still reach us by phone, and we learn about it from the logs.
    if (error instanceof EmailNotConfiguredError) {
      console.error("[contact] RESEND_API_KEY is not set; submission not delivered.");
      return NextResponse.json(
        {
          error: {
            code: "CONTACT_UNAVAILABLE",
            message:
              "Our contact form is temporarily unavailable. Please email info@greatwestgraphics.com or call us and we will pick it up right away.",
          },
        },
        { status: 503 },
      );
    }
    if (error instanceof EmailSendError) {
      console.error(`[contact] Resend refused the message: ${error.message}`);
      return NextResponse.json(
        {
          error: {
            code: "CONTACT_SEND_FAILED",
            message: "The message could not be sent. Please try again shortly.",
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "CONTACT_UNAVAILABLE",
          message: "The message could not be sent. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  }
}
