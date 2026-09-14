import { Hero } from "@/components/home/Hero";
import { Reveal } from "@/components/shared/Reveal";
import { IdeaToDelivery } from "@/components/home/HomeFigmaSections";
import { CategoryBrowse } from "@/components/home/CategoryBrowse";
import { BestSellers } from "@/components/home/BestSellers";
import {
  HowToOrder,
  OrderNowBand,
  PrintMethods,
} from "@/components/home/FigmaHomeSections";
import {
  TrustStrip,
  Testimonials,
  Gallery,
  VisitShop,
  StatsBand,
  CtaBand,
} from "@/components/home/StaticSections";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { BEST_SELLERS_SLUG } from "@/lib/commerce/best-sellers";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";

export const dynamic = "force-dynamic";

/**
 * Homepage section order: Hero → How to Order → Idea to Delivery → Product
 * Browse → Best Sellers → Reviews → Print Methods → Gallery → Visit → Trust →
 * Order Now → Stats → CTA.
 *
 * This started from Figma "Homepage/ Direction A/ Desktop 1441" (node
 * 2107:273), which opened on a "Quick Paths" trio — I need uniforms / I need
 * promo products / I have my own design. CodSphere UAT V2 row 63 removes that
 * trio outright, promotes the four "how to order" steps into the slot it
 * occupied, and drops the trust strip down into the position the four steps
 * used to hold. So the page now opens by explaining how ordering works rather
 * than by asking the visitor to self-classify.
 *
 * Best Sellers was added after that Figma pass, placed right after Product
 * Browse — the same position the mockup uses for its own equivalent
 * ("What are you creating?" tiles, then "Best sellers, ready to customize").
 * It renders nothing of its own accord whenever no product is currently
 * assigned to Best Sellers (see BestSellers.tsx), so it does not shift any
 * of the sections below it when empty.
 *
 * `Reveal` now wraps every section below the hero rather than an arbitrary
 * five of them — previously some sections faded in on scroll and others
 * simply appeared, which read as unfinished rather than restrained. The hero
 * itself is deliberately never wrapped: it must paint immediately.
 */
export default async function HomePage() {
  const [catalog, bestSellers, pricingConfig] = await Promise.all([
    loadStorefrontCatalog({ limit: 120 }),
    // Asked for by category rather than filtered out of the general page
    // above. That filter only ever saw the first 120 products, so a best
    // seller further down the catalogue silently never appeared — the
    // homepage showed one of four.
    loadStorefrontCatalog({ categorySlug: BEST_SELLERS_SLUG, limit: 24 }),
    // Lets the Best Sellers teaser price identically to the full catalogue
    // (same decorated-estimate helper, same shared browsing quantity) rather
    // than showing a blank-garment price — see catalog-card.ts.
    loadPublishedPricingV2(),
  ]);

  return (
    <>
      <Hero />

      <Reveal>
        <HowToOrder />
      </Reveal>

      <Reveal>
        <IdeaToDelivery />
      </Reveal>

      <Reveal>
        <CategoryBrowse categories={catalog.categories} />
      </Reveal>

      <Reveal>
        <BestSellers
          products={bestSellers.products}
          pricingConfig={pricingConfig}
        />
      </Reveal>

      <Reveal>
        <Testimonials />
      </Reveal>

      <Reveal>
        <PrintMethods />
      </Reveal>

      <Reveal>
        <Gallery />
      </Reveal>

      <Reveal>
        <VisitShop />
      </Reveal>

      {/* Row 63: the trust strip sat directly under the hero's neighbour,
          competing with the four steps for the same attention. It now takes
          the slot the four steps vacated — read after the work has been
          shown, which is where a "trusted by" belongs. */}
      <Reveal>
        <TrustStrip />
      </Reveal>

      <Reveal>
        <OrderNowBand />
      </Reveal>

      <Reveal>
        <StatsBand />
      </Reveal>

      <Reveal>
        <CtaBand />
      </Reveal>
    </>
  );
}
