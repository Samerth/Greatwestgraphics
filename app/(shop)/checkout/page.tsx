import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";

export default function CheckoutPage() {
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
