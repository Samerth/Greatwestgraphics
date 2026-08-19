import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";
import { resolveStoreContext } from "@/lib/commerce/store-context";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/checkout");
  }

  const store = await resolveStoreContext();
  if (!store.isPublic) {
    let isMember = false;
    try {
      const memberships = await (
        await createCommerceClient()
      ).listMyMemberships(session.personId);
      isMember = memberships.some((membership) => membership.accountId === store.accountId);
    } catch {
      isMember = false;
    }
    if (!isMember) {
      return (
        <section className="py-sp-8">
          <Container className="max-w-xl">
            <h1 className="font-display font-bold text-header mb-sp-3">
              {store.name} is invitation-only
            </h1>
            <p className="text-text-secondary mb-sp-4">
              You can browse this team store, but checkout is reserved for
              people the owner has invited. Ask them to send an invitation to{" "}
              <b>{session.email}</b>.
            </p>
            <div className="flex flex-wrap gap-sp-2">
              <ButtonLink href="/cart" variant="secondary">
                Back to cart
              </ButtonLink>
              <ButtonLink href="/leave-store">Shop the main site</ButtonLink>
            </div>
          </Container>
        </section>
      );
    }
  }

  return (
    <>
      <div className="bg-fill-subtle border-b border-border">
        <Container className="flex flex-wrap justify-between items-center gap-sp-3 py-sp-3">
          <p className="text-sm m-0">
            Preferencing Card, Apple Pay, Interac, or Net-30 is forward-looking —
            checkout still submits for design review. No payment is collected today.
          </p>
          <ButtonLink href="/quote" variant="secondary" size="sm">
            Request Formal Quote
          </ButtonLink>
        </Container>
      </div>

      <section className="py-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-4">
            Home / Shop / Cart / <b className="text-text-primary">Checkout</b>
          </div>
          <CheckoutWizard />
        </Container>
      </section>
    </>
  );
}
