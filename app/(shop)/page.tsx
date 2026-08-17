import { Hero } from "@/components/home/Hero";
import { Reveal } from "@/components/shared/Reveal";
import {
  IdeaToDelivery,
  QuickPaths,
} from "@/components/home/HomeFigmaSections";
import { CategoryBrowse } from "@/components/home/CategoryBrowse";
import {
  OrderNowBand,
  PrintMethods,
  ServicesBreakdown,
} from "@/components/home/FigmaHomeSections";
import {
  TrustStrip,
  Testimonials,
  Gallery,
  StatsBand,
  CtaBand,
} from "@/components/home/StaticSections";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";

export const dynamic = "force-dynamic";

/**
 * Homepage section order matches Figma "Homepage/ Direction A/ Desktop 1441"
 * (node 2107:273): Hero → Quick Paths → Idea to Delivery → Trust → Product
 * Browse → Reviews → Print Methods → Gallery → Order Now → Services → Stats → CTA.
 */
export default async function HomePage() {
  const catalog = await loadStorefrontCatalog({ limit: 120 });

  return (
    <>
      <Hero />
      <QuickPaths />

      <Reveal>
        <IdeaToDelivery />
      </Reveal>

      <TrustStrip />

      <Reveal>
        <CategoryBrowse categories={catalog.categories} />
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

      <OrderNowBand />
      <ServicesBreakdown />
      <StatsBand />
      <CtaBand />
    </>
  );
}
