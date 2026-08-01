import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export default function StartPendingPage() {
  return (
    <section className="py-sp-8">
      <Container className="max-w-xl text-center">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Almost there
        </span>
        <h1 className="font-display font-bold text-header leading-header mt-sp-2 mb-sp-3">
          Your store is being reviewed.
        </h1>
        <p className="text-text-secondary mb-sp-5">
          A specialist checks every new store before it goes live — usually
          within one business day. We&apos;ll be in touch as soon as yours is
          ready.
        </p>
        <ButtonLink href="/products" variant="secondary">
          Browse the catalogue in the meantime
        </ButtonLink>
      </Container>
    </section>
  );
}
