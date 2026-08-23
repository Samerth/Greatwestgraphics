import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { RedirectIfExistingStore } from "@/components/account/RedirectIfExistingStore";

export default function StartPendingPage() {
  return (
    <section className="py-sp-8">
      <RedirectIfExistingStore when="live-store" pollMs={12_000} />
      <Container className="max-w-xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Almost there
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-3">
          Your store is being reviewed.
        </h1>
        <p className="text-text-secondary mb-sp-5">
          A specialist checks every new store before it goes live — usually
          within one business day. When it is approved you will get an email
          with a link to open it, and this page will take you there if you
          stay signed in. You can invite colleagues now; their invitations
          wait until the store opens.
        </p>
        <div className="flex flex-wrap gap-sp-3 justify-center">
          <ButtonLink href="/account/team">Invite your team</ButtonLink>
          <ButtonLink href="/products" variant="secondary">
            Browse the catalogue in the meantime
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
