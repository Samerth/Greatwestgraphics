import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  EmailNotConfiguredError,
  EmailSendError,
  sendEmail,
} from "@/lib/email/send";
import { getImageStore } from "@/lib/storage";

const ContactSubmissionSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  topic: z.string().max(200).optional(),
  product: z.string().max(200).optional(),
  quantity: z.string().max(100).optional(),
  decorationMethod: z.string().max(100).optional(),
  neededBy: z.string().max(50).optional(),
  details: z.string().max(4_000).optional(),
});

// Same accepted types and per-file limit as staff proof uploads
// (app/admin/actions.ts) — one convention for "what's an acceptable artwork
// file" across the site rather than a second, silently different one here.
const ARTWORK_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};
const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const MAX_ARTWORK_FILES = 5;

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const str = typeof value === "string" ? value.trim() : "";
  return str || undefined;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const submission = ContactSubmissionSchema.parse({
      name: emptyToUndefined(form.get("name")) ?? "",
      email: emptyToUndefined(form.get("email")) ?? "",
      phone: emptyToUndefined(form.get("phone")),
      company: emptyToUndefined(form.get("company")),
      topic: emptyToUndefined(form.get("topic")),
      product: emptyToUndefined(form.get("product")),
      quantity: emptyToUndefined(form.get("quantity")),
      decorationMethod: emptyToUndefined(form.get("decorationMethod")),
      neededBy: emptyToUndefined(form.get("neededBy")),
      details: emptyToUndefined(form.get("details")),
    });

    // Artwork is genuinely optional — a customer without files yet can still
    // send everything else, matching the existing "details" field, which has
    // also moved from required to optional now that the structured fields
    // above usually carry the substance of the request.
    const files = form.getAll("artwork").filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );
    if (files.length > MAX_ARTWORK_FILES) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Please attach at most ${MAX_ARTWORK_FILES} files.`,
          },
        },
        { status: 400 },
      );
    }
    for (const file of files) {
      if (!ARTWORK_TYPES[file.type]) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `${file.name}: artwork must be a PNG, JPG, SVG, or PDF.`,
            },
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_ARTWORK_BYTES) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `${file.name} is too large — max 10MB per file.`,
            },
          },
          { status: 400 },
        );
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const artworkUrls: string[] = [];
    for (const file of files) {
      // Filed under designs/contact/ — the "contact" pseudo-owner keeps this
      // request within the same designs/* prefix the storage IAM role is
      // already scoped to (see lib/storage/upload-access.ts), rather than a
      // new top-level prefix that would need its own permissions in
      // production. Staff can always read anything under designs/ regardless
      // of owner, which is what actually matters here — nobody "owns" a
      // contact-form upload the way a signed-in customer owns their designs.
      const extension = ARTWORK_TYPES[file.type];
      const key = `designs/contact/${randomUUID()}.${extension}`;
      const storedPath = await getImageStore().put(
        key,
        Buffer.from(await file.arrayBuffer()),
        file.type,
      );
      artworkUrls.push(
        storedPath.startsWith("http")
          ? storedPath
          : `${siteUrl.replace(/\/$/, "")}${storedPath}`,
      );
    }

    const toEmail = process.env.CONTACT_TO_EMAIL || "info@greatwestgraphics.com";
    const subject = `New quote request: ${submission.topic || submission.product || "General inquiry"} — ${submission.name}`;
    const body = [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      submission.phone ? `Phone: ${submission.phone}` : null,
      submission.company ? `Company: ${submission.company}` : null,
      submission.topic ? `Topic: ${submission.topic}` : null,
      "",
      submission.product ? `Product / style: ${submission.product}` : null,
      submission.quantity ? `Quantity needed: ${submission.quantity}` : null,
      submission.decorationMethod ? `Decoration method: ${submission.decorationMethod}` : null,
      submission.neededBy ? `Needed by: ${submission.neededBy}` : null,
      artworkUrls.length > 0 ? "" : null,
      ...artworkUrls.map((url, i) => `Artwork ${i + 1}: ${url}`),
      submission.details ? "" : null,
      submission.details || null,
    ].filter((line) => line !== null).join("\n");

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
      console.error("[contact] AWS_REGION is not set; submission not delivered.");
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
      console.error(`[contact] SES refused the message: ${error.message}`);
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
