import { Hero } from "@/components/home/Hero";
import { Reveal } from "@/components/shared/Reveal";
import {
  IdeaToDelivery,
  QuickPaths,
} from "@/components/home/HomeFigmaSections";
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
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";

export const dynamic = "force-dynamic";

/**
 * Homepage section order matches Figma "Homepage/ Direction A/ Desktop 1441"
 * (node 2107:273): Hero → Quick Paths → Idea to Delivery → Trust → Product
 * Browse → Reviews → Print Methods → Gallery → Visit → How to Order →
 * Order Now → Stats → CTA.
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
  const [catalog, pricingConfig] = await Promise.all([
    loadStorefrontCatalog({ limit: 120 }),
    // Lets the Best Sellers teaser price identically to the full catalogue
    // (same decorated-estimate helper, same shared browsing quantity) rather
    // than showing a blank-garment price — see catalog-card.ts.
    loadPublishedPricingV2(),
  ]);

  return (
    <>
      <Hero />

      <Reveal>
        <QuickPaths />
      </Reveal>

      <Reveal>
        <IdeaToDelivery />
      </Reveal>

      <Reveal>
        <TrustStrip />
      </Reveal>

      <Reveal>
        <CategoryBrowse categories={catalog.categories} />
      </Reveal>

      <Reveal>
        <BestSellers products={catalog.products} pricingConfig={pricingConfig} />
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

      <Reveal>
        <HowToOrder />
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
