import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { StoreWizard } from "@/components/account/StoreWizard";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";
import { existingTeamStorePath } from "@/lib/commerce/membership";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/start");
  }

  let alreadyHasStore: string | null = null;
  try {
    const memberships = await (
      await createCommerceClient()
    ).listMyMemberships(session.personId);
    alreadyHasStore = existingTeamStorePath(memberships);
  } catch {
    // A failed lookup must not block a first-time owner from creating a store.
  }
  if (alreadyHasStore) {
    redirect(alreadyHasStore);
  }

  return (
    <section className="py-sp-8">
      <Container className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Branded store
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-2">
          Create your own ordering portal.
        </h1>
        <p className="text-text-secondary mb-sp-5 max-w-[60ch]">
          Your team gets a branded storefront — your name, your colours, your own
          address — while every order is produced and fulfilled by Great West
          Graphics behind the scenes.
        </p>
        <StoreWizard />
      </Container>
    </section>
  );
}
