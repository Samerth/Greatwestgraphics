import { Container } from "@/components/shared/Container";
import { ProductDetail } from "@/components/pdp/ProductDetail";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";
import { CATALOG } from "@/lib/data/products";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return CATALOG.map(({ slug }) => ({ slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = CATALOG.find((item) => item.slug === slug);
  if (!product) notFound();

  return (
    <>
      <section className="py-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            Home / Shop / {product.category} /{" "}
            <b className="text-text-primary">{product.name}</b>
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
