import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { InviteForm } from "@/components/account/InviteForm";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";

export const dynamic = "force-dynamic";

export default async function AccountTeamPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/account/team");
  }

  let memberships: Awaited<
    ReturnType<Awaited<ReturnType<typeof createCommerceClient>>["listMyMemberships"]>
  > = [];
  try {
    const client = await createCommerceClient();
    memberships = await client.listMyMemberships(session.personId);
  } catch {
    // Falls through to the empty state below.
  }

  return (
    <section className="py-sp-8">
      <Container className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Your team
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-5">
          Store & team access
        </h1>

        {memberships.length === 0 ? (
          <div>
            <p className="text-text-secondary mb-sp-4">
              You don&apos;t have a branded store yet.
            </p>
            <ButtonLink href="/start">Create your store</ButtonLink>
          </div>
        ) : (
          <div className="space-y-sp-5">
            {memberships.map((m) => (
              <div
                key={m.accountId}
                className="border border-border rounded-lg p-sp-4 bg-bg-raised"
              >
                <div className="flex items-center justify-between gap-3 mb-sp-3">
                  <div>
                    <p className="font-display font-bold text-lg m-0">{m.storeName}</p>
                    <p className="text-[13px] text-text-tertiary m-0 mt-1">
                      {m.storeSlug}.greatwestgraphics.com · {m.role}
                      {m.storeStatus !== "active" ? ` · ${m.storeStatus}` : ""}
                    </p>
                  </div>
                </div>
                {m.role === "owner" && <InviteForm accountId={m.accountId} />}
              </div>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
