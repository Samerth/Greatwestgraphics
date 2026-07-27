import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { ProductsGrid } from "@/components/products/ProductsGrid";
import { CATEGORIES, type Category } from "@/lib/data/products";

const CATEGORY_SLUGS: Record<string, Category> = {
  apparel: "Apparel",
  bags: "Bags",
  "hats-beanies": "Headwear",
  headwear: "Headwear",
  outerwear: "Outerwear",
  polos: "Polos",
  promo: "Promo",
  safety: "Safety",
  "signs-displays": "Signs",
  signs: "Signs",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const initialCategory =
    (category && CATEGORY_SLUGS[category.toLowerCase()]) || "All";

  return (
    <>
      <section className="pt-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            Home / Shop / <b className="text-text-primary">Full Catalogue</b>
          </div>
          <h1 className="font-display font-bold text-display leading-display max-w-[14ch]">
            Everything we <span className="text-accent">print,</span> stitch &amp; press.
          </h1>
          <p className="text-text-secondary max-w-[60ch] mt-sp-3">
            Real products, real methods, real starting prices. Filter by what you need —
            apparel, safety, promo, signage — or jump straight to a category.
          </p>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <ProductsGrid
            initialCategory={
              CATEGORIES.includes(initialCategory as Category)
                ? (initialCategory as Category)
                : "All"
            }
          />

          <div className="mt-sp-4 border border-border rounded-lg bg-bg-raised px-sp-5 py-sp-4 flex flex-wrap gap-sp-3 justify-between items-center">
            <h4 className="text-[19px] max-w-[520px] font-display font-bold">
              Can&apos;t find it? We stock <span className="text-accent">1,000+</span> more
              items from every major North American blank supplier.
            </h4>
            <div className="flex gap-2.5">
              <ButtonLink href="/products" variant="secondary">
                Browse Full Catalogue
              </ButtonLink>
              <ButtonLink href="/quote" variant="primary">
                Request a Custom Quote
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
