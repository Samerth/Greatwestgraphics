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

const GALLERY_LABELS = [
  { name: "Marriott", meta: "Staff uniforms · embroidered" },
  { name: "Fujitsu", meta: "Corporate polos · branded" },
  { name: "St. George's School", meta: "Athletics hoodies · 3-colour" },
  { name: "Grande West", meta: "Crew tees · branded" },
  { name: "Local nonprofit", meta: "Canvas totes · benefit run" },
  { name: "Community event", meta: "Staff tees · rush order" },
  { name: "Trade & safety crew", meta: "Hi-vis hoodies · CSA" },
];

/**
 * Homepage section order matches Figma "Homepage/ Direction A/ Desktop 1441"
 * (node 2107:273): Hero → Quick Paths → Idea to Delivery → Trust → Product
 * Browse → Reviews → Print Methods → Gallery → Order Now → Services → Stats → CTA.
 */
export default async function HomePage() {
  const catalog = await loadStorefrontCatalog({ limit: 120 });
  const seenStyles = new Set<string>();
  const withPhoto = catalog.products.filter((p) => {
    if (!p.available || !p.imageUrl) return false;
    const styleKey = `${p.brandName}::${p.styleName}`;
    if (seenStyles.has(styleKey)) return false;
    seenStyles.add(styleKey);
    return true;
  });
  const galleryItems = GALLERY_LABELS.map((label, index) => ({
    ...label,
    artIndex: index + 1,
    imageUrl: withPhoto[index % Math.max(withPhoto.length, 1)]?.imageUrl,
  }));

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
        <Gallery items={galleryItems} />
      </Reveal>

      <OrderNowBand />
      <ServicesBreakdown />
      <StatsBand />
      <CtaBand />
    </>
  );
}
