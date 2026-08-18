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

    // Behind a CDN the request origin is whatever reached the container, which
    // can be the load balancer's own address and is plain http. An invite is a
    // link somebody clicks days later out of an inbox, so it has to be the
    // address the site is actually published on.
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
      new URL(request.url).origin;
    const link = `${origin}/invite/${token}`;
    try {
      await sendEmail({
        to: email,
        subject: `${session.name} invited you to join ${accountName} on Great West Graphics`,
        text: `${session.name} invited you to join ${accountName}'s ordering portal.\n\nAccept the invite: ${link}\n\nThis link expires in 7 days.`,
      });
    } catch (sendFailure) {
      if (
        sendFailure instanceof EmailNotConfiguredError ||
        sendFailure instanceof EmailSendError
      ) {
        console.error(
          `[invite] Invite created but not emailed: ${sendFailure.message}`,
        );
        return NextResponse.json({ status: "created-not-sent", link });
      }
      throw sendFailure;
    }

    // The link goes back to the inviter as well as to the invitee's inbox.
    // Deliverability is not something the person waiting on a colleague can
    // fix, and until the sending domain is verified most invitations do not
    // arrive at all; an owner holding the link can simply pass it on.
    return NextResponse.json({ status: "sent", link });
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
    return NextResponse.json(
      { error: { code: "INVITE_FAILED", message: "Could not send the invite." } },
      { status: 500 },
    );
  }
}
