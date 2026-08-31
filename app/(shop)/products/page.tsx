import type { Metadata } from "next";
//import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { ProductsGrid } from "@/components/products/ProductsGrid";
import { Pagination } from "@/components/products/Pagination";
import { CatalogUnavailable } from "@/components/shared/CatalogUnavailable";
//import { cn } from "@/lib/utils/cn";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";
import { loadStorefrontCatalog, loadStorefrontCategories } from "@/lib/commerce/catalog";


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
      alternates: { canonical: "/shop" },
    };
  }

  // Full (unfiltered) list — a direct link to an empty category (e.g.
  // Drinkware) should still get its real display name in the page title,
  // not just a lowercase slug fallback.
  const categories = await loadStorefrontCategories(false);
  const match = categories.find((c) => c.slug === category.toLowerCase());
  const name = match?.name || category;
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

/** The catalogue is the widest surface on the site: a 280px filter rail plus
 * a product grid. The default container caps out too early and left the grid
 * two columns wide on a desktop monitor, so the shop opts into a wider shell. */
const SHOP_SHELL = "max-w-[1680px] xl:px-10 2xl:px-12";

const SHOP_ASSURANCES = [
  "Free digital proof on every order",
  "In-house printing since 1980",
  "Vancouver pickup or Canada-wide courier",
];

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
  // "db" and "empty" are both successful responses — a category with no
  // synced inventory is a real answer and gets a real empty state. Only
  // "error" means we could not reach the catalogue at all.
  const catalogFailed = catalog.source === "error";
  // Retry what they were actually doing, filters and all, rather than dumping
  // them back on an unfiltered page one.
  const retryParams = new URLSearchParams();
  if (search) retryParams.set("q", search);
  if (category) retryParams.set("category", category);
  if (page > 1) retryParams.set("page", String(page));
  for (const b of brands ?? []) retryParams.append("brand", b);
  if (priceMinMinor != null) retryParams.set("priceMin", String(priceMinMinor));
  if (priceMaxMinor != null) retryParams.set("priceMax", String(priceMaxMinor));
  const retryQuery = retryParams.toString();
  const retryHref = `/products${retryQuery ? `?${retryQuery}` : ""}`;
  // The heading was hardcoded to "Shop All Products" whatever the filter was,
  // so every category link in the footer, the header menu and the tiles below
  // landed on a page that announced itself as the whole catalogue. Only the
  // <title> knew which category had been asked for. The full category list is
  // used rather than `catalog.categories`, which only carries the ones that
  // currently have stock — an empty category still deserves its real name.
  const allCategories = category ? await loadStorefrontCategories(false) : [];
  const heading = category
    ? (allCategories.find((c) => c.slug === category.toLowerCase())?.name ??
      // Unknown slug, or the category list itself is unreachable. The listing
      // below is empty or unavailable either way, so show the slug readably
      // rather than pretending the filter was the whole catalogue.
      category
        .slice(0, 48)
        .replace(/[^a-zA-Z0-9-]/g, "")
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "))
    : "Shop All Products";

  return (
    <>
      <section className="pt-sp-6 pb-sp-5 border-b border-border bg-bg-raised">
        <Container className={SHOP_SHELL}>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            Home /{" "}
            {category ? (
              <>
                <Link href="/products" className="hover:text-accent">
                  Shop All Products
                </Link>{" "}
                / <b className="text-text-primary">{heading}</b>
              </>
            ) : (
              <b className="text-text-primary">Shop All Products</b>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-sp-4">
            <div className="min-w-0">
              <h1 className="font-display font-bold text-display leading-display max-w-[16ch] m-0">
                {heading}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {SHOP_ASSURANCES.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-[12.5px] font-semibold text-text-secondary"
                >
                  {line}
                </span>
              ))}
            </div>
          </div>

        </Container>
      </section>

      <section className="pt-sp-4 pb-sp-6 lg:pt-sp-5 lg:pb-sp-8">
        <Container className={SHOP_SHELL}>
          {catalogFailed ? (
            <CatalogUnavailable retryHref={retryHref} />
          ) : (
            <>
              <ProductsGrid
                key={retryQuery || "all"}
                dbProducts={catalog.products}
                dbCategories={catalog.categories}
                dbBrands={catalog.brands}
                resultTotal={catalog.total}
                activeCategorySlug={category || null}
                activeBrands={brands}
                activePriceMinMinor={priceMinMinor}
                activePriceMaxMinor={priceMaxMinor}
                activeSearch={search ?? null}
              />

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
            </>
          )}

          <div className="mt-sp-4 border border-border rounded-lg bg-bg-raised px-sp-5 py-sp-4 flex flex-wrap gap-sp-3 justify-between items-center">
            <h4 className="text-[19px] max-w-[520px] font-display font-bold">
              Can&apos;t find it? We stock <span className="text-accent">1,000+</span>{" "}
              more items from every major North American blank supplier.
            </h4>
            <div className="flex gap-2.5">
              {/* "Browse Full Catalogue" used to sit here pointing at
                  /products — the page it was already on. */}
              <ButtonLink href="/contact" variant="secondary">
                Ask us to source it
              </ButtonLink>
              {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
                <ButtonLink href="/quote" variant="primary">
                  Request a Custom Quote
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
