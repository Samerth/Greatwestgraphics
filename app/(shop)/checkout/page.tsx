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
    // Checkout is the only place that auto-joins on arrival — the shop
    // layout never did, despite what an earlier comment here claimed.
    // This repeat exists so checkout is never the odd one out if it's ever
    // reached by some other path. The commerce API still
    // enforces membership server-side on submission either way.
    try {
      const client = await createCommerceClient();
      const memberships = await client.listMyMemberships(session.personId);
      const isMember = memberships.some(
        (membership) => membership.accountId === store.accountId,
      );
      if (!isMember) {
        await client.joinAccount(store.accountId, session.personId);
      }
    } catch {
      // Not fatal here — see comment above.
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
