import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Resend } from "resend";

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
    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.CONTACT_TO_EMAIL || "info@greatwestgraphics.com";
    const fromEmail =
      process.env.CONTACT_FROM_EMAIL ||
      "Great West Graphics <onboarding@resend.dev>";

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

    if (!apiKey) {
      console.log("[contact] RESEND_API_KEY not set — logging submission instead of sending.");
      console.log(body);
      return NextResponse.json({ status: "logged" });
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: submission.email,
      subject,
      text: body,
    });

    if (error) {
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

    return NextResponse.json({ status: "sent" });
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
