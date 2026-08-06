import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";

export default function NotFound() {
  return (
    <section className="py-sp-8">
      <Container className="text-center max-w-xl">
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Page not found
        </p>
        <h1 className="font-display font-bold text-display leading-display mt-sp-2">
          That link doesn&apos;t go anywhere.
        </h1>
        <p className="text-text-secondary mt-sp-3">
          The page may have moved, or the product is no longer listed. Head back
          to the shop or open your jobs portal.
        </p>
        <div className="mt-sp-5 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/products">Browse products</ButtonLink>
          <ButtonLink href="/portal/jobs" variant="secondary">
            My jobs
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}