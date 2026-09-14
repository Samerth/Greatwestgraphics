import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CatalogImage } from "@/components/shared/CatalogImage";
import { CatalogUnavailable } from "@/components/shared/CatalogUnavailable";
import { BrandDepartmentTiles } from "@/components/products/BrandDepartmentTiles";
import { ProductCarouselRow } from "@/components/products/BestSellersSections";
import { loadStorefrontBrand, loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";
import { BEST_SELLERS_SLUG } from "@/lib/commerce/best-sellers";
import {
  brandBlurb,
  brandHeading,
  brandListingHref,
  styleCountLabel,
} from "@/lib/commerce/brand-page";

export const dynamic = "force-dynamic";

const SHOP_ASSURANCES = [
  "Free digital proof on every order",
  "In-house printing since 1980",
  "Vancouver pickup or Canada-wide courier",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadStorefrontBrand(slug);
  if (result.kind !== "found") return { title: "Brands" };
  const title = `${brandHeading(result.brand)} — Screen Printed & Embroidered in Vancouver`;
  const description = brandBlurb(result.brand);
  return {
    title,
    description,
    alternates: { canonical: `/brands/${slug}` },
    openGraph: { title, description, url: `/brands/${slug}` },
  };
}

/**
 * A brand's own page (UAT V2 row 62, second pass). The header's Brands menu
 * lands here rather than on the full catalogue with a checkbox ticked.
 *
 * Everything on the page is read from the catalogue: the departments and
 * their counts, the photos on the tiles, and the popular row - which is the
 * brand's styles that staff have put in Best Sellers, falling back to the
 * brand's listing order when none are. Nothing here is curated separately,
 * so a brand page cannot go stale.
 */
export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadStorefrontBrand(slug);
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") {
    return (
      <section className="py-sp-6">
        <Container>
          <CatalogUnavailable retryHref={`/brands/${encodeURIComponent(slug)}`} />
        </Container>
      </section>
    );
  }
  const brand = result.brand;
  const hasBestSellers = brand.categories.some(
    (category) => category.slug === BEST_SELLERS_SLUG,
  );

  const [popular, pricingConfig] = await Promise.all([
    loadStorefrontCatalog({
      brands: [brand.name],
      categorySlug: hasBestSellers ? BEST_SELLERS_SLUG : undefined,
      limit: 12,
    }),
    loadPublishedPricingV2().catch(() => null),
  ]);
  const allHref = brandListingHref(brand);

  return (
    <>
      <section className="pt-sp-6 pb-sp-5 border-b border-border bg-bg-raised">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-3">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>{" "}
            /{" "}
            <Link href="/brands" className="hover:text-accent">
              Brands
            </Link>{" "}
            / <b className="text-text-primary">{brand.name}</b>
          </div>

          <div className="flex flex-wrap items-center gap-sp-5">
            {brand.logoUrl && (
              <div className="relative h-16 w-40 shrink-0 bg-white rounded-md border border-border">
                <CatalogImage
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  fill
                  sizes="160px"
                  className="object-contain p-2"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display font-bold text-display leading-display max-w-[16ch] m-0">
                {brandHeading(brand)}
              </h1>
              <p className="m-0 mt-2 text-text-secondary max-w-[62ch]">
                {brandBlurb(brand)}
              </p>
            </div>
            <ButtonLink href={allHref} variant="primary" className="shrink-0">
              Shop all {brand.name} ({brand.styleCount})
            </ButtonLink>
          </div>

          <div className="mt-sp-4 flex flex-wrap gap-2">
            {SHOP_ASSURANCES.map((line) => (
              <span
                key={line}
                className="rounded-full border border-border bg-bg px-3 py-1.5 text-[12.5px] font-semibold text-text-secondary"
              >
                {line}
              </span>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-sp-6 lg:py-sp-7">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-sp-3 mb-sp-4">
            <h2 className="font-display font-bold text-[24px] m-0">
              Shop {brand.name} by product type
            </h2>
            <Link href={allHref} className="text-[14px] font-bold text-accent hover:underline">
              View all {styleCountLabel(brand.styleCount)} →
            </Link>
          </div>
          <BrandDepartmentTiles brand={brand} />
        </Container>
      </section>

      {popular.products.length > 0 && (
        <section className="pb-sp-7 lg:pb-sp-8">
          <Container>
            <ProductCarouselRow
              heading={hasBestSellers ? `${brand.name} best sellers` : `Popular ${brand.name} styles`}
              scrollLabel={brand.name}
              viewAllHref={allHref}
              viewAllLabel={`View all ${brand.name}`}
              products={popular.products}
              pricingConfig={pricingConfig}
            />
          </Container>
        </section>
      )}

      <section className="pb-sp-7">
        <Container>
          <div className="border border-border rounded-lg bg-bg-raised px-sp-5 py-sp-4 flex flex-wrap gap-sp-3 justify-between items-center">
            <h4 className="text-[19px] max-w-[520px] font-display font-bold m-0">
              Need a {brand.name} style that isn&apos;t listed? We can source most of
              the range.
            </h4>
            <ButtonLink href="/contact" variant="secondary">
              Ask us to source it
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
