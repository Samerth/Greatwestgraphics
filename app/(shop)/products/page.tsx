import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { ProductsGrid } from "@/components/products/ProductsGrid";
import { Pagination } from "@/components/products/Pagination";
import { CATEGORIES, type Category } from "@/lib/data/products";
import { loadStorefrontCatalog, loadStorefrontCategories } from "@/lib/commerce/catalog";

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

const OVERLAY_TILES = [
  { name: "T-Shirts", slug: "t-shirts", blurb: "Crews, V-necks & athletic" },
  { name: "Hoodies", slug: "hoodies-and-crewnecks", blurb: "Fleece & crewnecks" },
  { name: "Hats", slug: "hats", blurb: "Caps, beanies & truckers" },
  { name: "Bags", slug: "bags", blurb: "Totes, backpacks & more" },
];

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}): Promise<Metadata> {
  const { category } = await searchParams;
  if (!category) {
    return {
      title: "Full Catalogue",
      description:
        "Browse our full custom apparel and promotional products catalogue — apparel, headwear, bags, outerwear, safety wear and signage, screen printed or embroidered in Vancouver.",
      alternates: { canonical: "/products" },
    };
  }

  // Full (unfiltered) list — a direct link to an empty category (e.g.
  // Drinkware) should still get its real display name in the page title,
  // not just a lowercase slug fallback.
  const categories = await loadStorefrontCategories(false);
  const match = categories.find((c) => c.slug === category.toLowerCase());
  const name = match?.name || CATEGORY_SLUGS[category.toLowerCase()] || category;
  const title = `${name} — Custom Decorated`;
  const description = `Shop custom decorated ${name.toLowerCase()} — screen printed or embroidered in Vancouver, proofed before production.`;

  return {
    title,
    description,
    alternates: { canonical: `/products?category=${encodeURIComponent(category)}` },
    openGraph: { title, description, url: `/products?category=${encodeURIComponent(category)}` },
  };
}

const PAGE_SIZE = 60;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
    brand?: string | string[];
    priceMin?: string;
    priceMax?: string;
  }>;
}) {
  const { q, category, page: pageParam, brand, priceMin, priceMax } = await searchParams;
  const search = q?.trim() || undefined;
  const page = Math.max(1, Number(pageParam) || 1);
  const brands = brand ? (Array.isArray(brand) ? brand : [brand]) : undefined;
  const priceMinMinor = priceMin ? Number(priceMin) : undefined;
  const priceMaxMinor = priceMax ? Number(priceMax) : undefined;
  const catalog = await loadStorefrontCatalog({
    search,
    categorySlug: category,
    limit: PAGE_SIZE,
    page,
    brands,
    priceMinMinor,
    priceMaxMinor,
  });
  // "db" and "empty" are both real, successful catalog responses — only
  // "error" (the API call itself failed) should fall back to the static
  // demo catalog. Otherwise a legitimate zero-result category (e.g.
  // Drinkware, which has no synced inventory yet) would incorrectly show
  // the unrelated static demo products instead of a real empty state.
  const preferDb = catalog.source === "db" || catalog.source === "empty";
  const initialCategory =
    (category && CATEGORY_SLUGS[category.toLowerCase()]) || "All";

  return (
    <>
      <section className="pt-sp-8">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            Home / <b className="text-text-primary">Shop All Products</b>
          </div>
          <h1 className="font-display font-bold text-display leading-display max-w-[16ch]">
            Shop All Products
          </h1>
          <p className="text-text-secondary max-w-[60ch] mt-sp-3">
            {preferDb
              ? "Live blanks from the local S&S catalog. Out-of-stock colours stay visible as unavailable."
              : "Real products, real methods, real starting prices. Filter by what you need — apparel, safety, promo, signage — or jump straight to a category."}
          </p>
          {catalog.source === "error" && (
            <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mt-sp-3 max-w-[60ch]">
              We&apos;re having trouble reaching the live catalog right now — showing
              a default view instead.{" "}
              <a href="/products" className="font-bold underline">
                Retry
              </a>
              .
            </p>
          )}
        </Container>
      </section>

      <section className="pt-sp-5 pb-0">
        <Container>
          <h2 className="font-display font-bold text-[19px] m-0">Shop by Category</h2>
          <div className="mt-sp-3 grid grid-cols-2 lg:grid-cols-4 gap-sp-3">
            {OVERLAY_TILES.map((tile) => (
              <Link
                key={tile.slug}
                href={`/products?category=${encodeURIComponent(tile.slug)}`}
                className="group relative overflow-hidden rounded-md border border-border min-h-[140px] flex items-end p-sp-3 text-white"
                style={{
                  background:
                    "linear-gradient(160deg, var(--color-accent) 0%, #0b1f4a 55%, #0D0D0D 100%)",
                }}
              >
                <span
                  className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 50%)",
                  }}
                  aria-hidden
                />
                <span className="relative">
                  <span className="block font-display font-bold text-base">{tile.name}</span>
                  <span className="block text-xs text-white/80 mt-1">{tile.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <ProductsGrid
            preferDb={preferDb}
            dbProducts={catalog.products}
            dbCategories={catalog.categories}
            dbBrands={catalog.brands}
            activeCategorySlug={category || null}
            activeBrands={brands}
            activePriceMinMinor={priceMinMinor}
            activePriceMaxMinor={priceMaxMinor}
            activeSearch={search ?? null}
            initialCategory={
              CATEGORIES.includes(initialCategory as Category)
                ? (initialCategory as Category)
                : "All"
            }
          />

          {preferDb && (
            <Pagination
              page={catalog.page}
              pageCount={catalog.pageCount}
              total={catalog.total}
              pageSize={catalog.pageSize}
              category={category}
              brands={brands}
              priceMinMinor={priceMinMinor}
              priceMaxMinor={priceMaxMinor}
              search={search}
            />
          )}

          <div className="mt-sp-4 border border-border rounded-lg bg-bg-raised px-sp-5 py-sp-4 flex flex-wrap gap-sp-3 justify-between items-center">
            <h4 className="text-[19px] max-w-[520px] font-display font-bold">
              Can&apos;t find it? We stock <span className="text-accent">1,000+</span>{" "}
              more items from every major North American blank supplier.
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
