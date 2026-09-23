import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";
import { resolveStoreContext } from "@/lib/commerce/store-context";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Was untitled (audit: "Ten routes share the home page's title").
export const metadata: Metadata = { title: "Checkout" };

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
            Checkout submits your order for design review — no payment is
            collected today. Payment is arranged on the invoice once your
            proof is approved.
          </p>
          {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
            <ButtonLink href="/quote" variant="secondary" size="sm">
              Request Formal Quote
            </ButtonLink>
          ) : null}
        </Container>
      </div>

      <section className="py-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-4">
            Home / Shop / Cart / <b className="text-text-primary">Checkout</b>
          </div>
          {/* The account already knows a signed-in customer's name and
              email — checkout used to ask for them again from scratch every
              time, ignoring the session it already holds (client feedback:
              "Pre fill check out if logged in or already entered"). No
              phone is passed because the account has never stored one;
              the phone field still starts blank and is not faked. */}
          <CheckoutWizard
            sessionContact={{ fullName: session.name, email: session.email }}
          />
        </Container>
      </section>
    </>
  );
}
