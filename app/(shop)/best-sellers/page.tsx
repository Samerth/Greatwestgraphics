import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { BestSellersSections } from "@/components/products/BestSellersSections";
import { BrowsingQuantityControl } from "@/components/products/BrowsingQuantityControl";
import { CheapestMatchFinder } from "@/components/quote-builder/CheapestMatchFinder";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";
import {
  BEST_SELLERS_BLURB,
  BEST_SELLERS_SLUG,
  BEST_SELLERS_TITLE,
  groupBestSellersByCategory,
} from "@/lib/commerce/best-sellers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Best Sellers",
  description:
    "Our most popular custom apparel and promotional products, grouped by category.",
  alternates: { canonical: "/best-sellers" },
};

/**
 * Best Sellers, arranged by category (CodSphere UAT V2 row 68, and Pavin on
 * 11 September: "organise Best Sellers by category").
 *
 * Which products appear is curated in the admin exactly as it already was —
 * Best Sellers is a real catalogue category, so assigning a product to it is
 * all staff need to do. No separate list to maintain and no second place for
 * it to fall out of step.
 */
export default async function BestSellersPage() {
  const [{ products, categories, source }, pricingConfig, wholeCatalog] =
    await Promise.all([
      loadStorefrontCatalog({ categorySlug: BEST_SELLERS_SLUG, limit: 200 }),
      loadPublishedPricingV2().catch(() => null),
      // The cheapest-match finder below has to search the *whole* catalogue,
      // not the best-seller slice this page renders — "give results based on
      // cheapest price product" (Pavin, 15 September) means cheapest overall.
      // Ungrouped so every colourway is its own candidate, since colour is
      // what decides the dark-garment underbase surcharge.
      loadStorefrontCatalog({ limit: 150, groupByStyle: false }).catch(() => null),
    ]);

  const sections = groupBestSellersByCategory(products, categories);

  const finderCandidates =
    wholeCatalog?.products.map((p) => ({
      id: p.id,
      label: `${p.brandName} ${p.styleName} · ${p.colorName}`.trim(),
      brandName: p.brandName,
      styleName: p.styleName,
      title: p.title,
      colorName: p.colorName,
      unitCostMinor: p.costMinor,
      isDark: p.isDark,
      available: p.available,
      slug: p.slug,
      categorySlugs: p.categorySlugs,
    })) ?? [];
  // Top-level only ("T-Shirts", "Hoodies", "Headwear"), not every
  // subcategory, so the garment-type buttons stay a handful, not a wall.
  const garmentTypes =
    wholeCatalog?.categories
      .filter((c) => c.parentId === null)
      .map((c) => ({ slug: c.slug, name: c.name })) ?? [];

  return (
    <section className="py-sp-6">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-sp-3 mb-sp-5">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-display-sm m-0">
              {BEST_SELLERS_TITLE}
            </h1>
            <p className="text-text-secondary mt-2 mb-0 max-w-[62ch]">
              {BEST_SELLERS_BLURB}
            </p>
          </div>
          {/* The same control as the full catalogue, and the same shared
              quantity behind it — changing it here changes every card on
              the site, which is the point of row 17. */}
          <BrowsingQuantityControl className="shrink-0" />
        </div>

        {/* "Get an Instant Quote" in the hero lands here, so the page has to
            be able to answer that for a customer who doesn't yet know which
            garment they want — which is exactly what Pavin asked for on
            15 September: a small form, preset buttons, priced on the cheapest
            matching product, linking out to that product's page. It sits
            above the grid because it is the reason this page gets opened
            from the homepage. */}
        {pricingConfig && garmentTypes.length > 0 && finderCandidates.length > 0 && (
          <div className="mb-sp-6">
            <CheapestMatchFinder
              pricingConfig={pricingConfig}
              garmentTypes={garmentTypes}
              candidates={finderCandidates}
            />
          </div>
        )}

        {source === "error" ? (
          <p role="alert" className="text-text-secondary">
            We are having trouble loading the catalogue right now. Please try
            again in a moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-sp-5 items-start">
            {/* Jumps down the page rather than filtering it: every section is
                already on screen, so filtering would only hide things the
                customer can see. */}
            <nav
              aria-label="Best seller categories"
              className="hidden lg:block sticky top-[120px]"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0 mb-2">
                Jump to
              </p>
              <ul className="list-none m-0 p-0 space-y-1">
                {sections.map((section) => (
                  <li key={section.slug}>
                    <Link
                      href={`#${section.anchor}`}
                      className="block text-[13.5px] text-text-secondary hover:text-accent transition-colors"
                    >
                      {section.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-w-0">
              <BestSellersSections
                sections={sections}
                pricingConfig={pricingConfig}
              />
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
