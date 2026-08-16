import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCustomerSession } from "@/lib/auth/session";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import {
  EmailNotConfiguredError,
  EmailSendError,
  sendEmail,
} from "@/lib/email/send";

const BodySchema = z.object({
  accountId: z.string(),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_SIGNED_IN", message: "Sign in first." } },
      { status: 401 },
    );
  }
  try {
    const { accountId, email } = BodySchema.parse(await request.json());
    const client = await createCommerceClient();
    const { token, accountName } = await client.createAccountInvite(
      accountId,
      session.personId,
      email,
    );

    const origin = new URL(request.url).origin;
    const link = `${origin}/invite/${token}`;
    await sendEmail({
      to: email,
      subject: `${session.name} invited you to join ${accountName} on Great West Graphics`,
      text: `${session.name} invited you to join ${accountName}'s ordering portal.\n\nAccept the invite: ${link}\n\nThis link expires in 7 days.`,
    });

    return NextResponse.json({ status: "sent" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Enter a valid email." } },
        { status: 400 },
      );
    }
    if (error instanceof CommerceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    // The invite row and its token already exist by the time the mail is
    // attempted, so this is not a failed invite — it is an invite nobody was
    // told about. Saying so stops the sender from assuming the colleague has a
    // link, which a bare "could not send the invite" would imply.
    if (error instanceof EmailNotConfiguredError || error instanceof EmailSendError) {
      console.error(`[invite] Invite created but not emailed: ${error.message}`);
      return NextResponse.json(
        {
          error: {
            code: "INVITE_EMAIL_FAILED",
            message:
              "The invite was created but the email could not be sent. Please send them the link yourself or try again shortly.",
          },
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: { code: "INVITE_FAILED", message: "Could not send the invite." } },
      { status: 500 },
    );
  }
}
