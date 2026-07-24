import { Container } from "@/components/shared/Container";
import { ProductDetail } from "@/components/pdp/ProductDetail";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";

// TODO: params.slug resolves against the synced product table once
// the SanMar integration is live; hardcoded demo data for now.
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <section className="py-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            Home / Shop / Apparel / <b className="text-text-primary">T-Shirts</b>
          </div>
          <ProductDetail slug={slug} />
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <CrossSellGrid title="Complete your project" />
        </Container>
      </section>
    </>
  );
}
