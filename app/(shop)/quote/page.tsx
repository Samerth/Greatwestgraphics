import { Container } from "@/components/shared/Container";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";

export default function QuotePage() {
  return (
    <>
      <section className="pt-sp-8">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Instant planning estimate
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[16ch]">
            Build a better print quote.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch]">
            Choose a product, quantity and decoration method to see a live estimate.
            Final pricing is confirmed after artwork, garment and delivery review.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <QuoteBuilder />
          <p className="text-xs text-text-tertiary mt-sp-3 max-w-[72ch]">
            Estimates are for planning only and exclude tax, specialty finishing and
            freight. Quote submission will be connected when backend work begins.
          </p>
        </Container>
      </section>
    </>
  );
}
