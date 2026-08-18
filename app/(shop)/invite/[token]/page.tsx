import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient, CommerceApiError } from "@/lib/commerce/client";
import { AcceptInviteButton } from "@/components/account/AcceptInviteButton";

export const dynamic = "force-dynamic";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/account?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  let error: string | undefined;
  let invite:
    | { email: string; status: string; accountName?: string | null }
    | undefined;
  try {
    const client = await createCommerceClient();
    invite = await client.getAccountInvite(token);
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : "This invite could not be found.";
  }

  return (
    <section className="py-sp-8">
      <Container className="max-w-md text-center">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Team invite
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-4">
          {invite?.accountName
            ? `Join ${invite.accountName}`
            : "Join the team"}
        </h1>

        {invite?.status === "pending" && (
          <p className="text-text-secondary mb-sp-4">
            You have been invited to order from
            {invite.accountName ? ` ${invite.accountName}'s` : " your team's"}{" "}
            store. Accepting adds you to the team so you can place orders
            against its pricing; it does not share anyone&apos;s payment
            details with you.
          </p>
        )}

        {error && <p className="text-[14px] text-red-600 font-semibold">{error}</p>}

        {invite && invite.status !== "pending" && (
          <p className="text-text-secondary">This invite has already been used.</p>
        )}

        {invite && invite.status === "pending" && (
          <>
            {invite.email.toLowerCase() !== session.email.toLowerCase() ? (
              <p className="text-text-secondary">
                This invite was sent to <b>{invite.email}</b>, but you&apos;re signed
                in as <b>{session.email}</b>. Sign in with the invited email to
                accept it.
              </p>
            ) : (
              <AcceptInviteButton token={token} />
            )}
          </>
        )}
      </Container>
    </section>
  );
}
