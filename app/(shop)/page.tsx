import { Hero } from "@/components/home/Hero";
import { Container } from "@/components/shared/Container";
import { Reveal } from "@/components/shared/Reveal";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";
import { WalkTheFloor } from "@/components/home/WalkTheFloor";
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
import { DEFAULT_PRICING_CONFIG_V1 } from "@/lib/utils/quote-pricing";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import type { PricingConfig } from "@gwg/contracts";
import Link from "next/link";

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

const QUICK_PATHS = [
  {
    num: "01",
    title: "I need uniforms",
    body: "Kit out a team, crew or school. Bulk apparel, embroidered or printed, sized and sorted.",
    href: "/products",
  },
  {
    num: "02",
    title: "I need promo products",
    body: "Swag, giveaways and event gear. Pens to tote bags, branded and delivered on deadline.",
    href: "/products",
  },
  {
    num: "03",
    title: "I have my own design",
    body: "Upload artwork and go. We proof it, match your colours, and print it right the first time.",
    href: "/design",
  },
];

export default async function HomePage() {
  let pricingConfig: PricingConfig = DEFAULT_PRICING_CONFIG_V1;
  try {
    pricingConfig = (await (await createCommerceClient()).getPublishedPricingConfig())
      .config;
  } catch (caught) {
    if (!(caught instanceof CommerceApiError)) {
      // keep bundled defaults
    }
  }

  const [catalog, quoteCatalog] = await Promise.all([
    loadStorefrontCatalog({ limit: 120 }),
    loadStorefrontCatalog({ limit: 150 }),
  ]);
  const catalogProducts = quoteCatalog.products.map((p) => ({
    id: p.id,
    label: `${p.brandName} ${p.styleName} · ${p.colorName}`.trim(),
    brandName: p.brandName,
    styleName: p.styleName,
    title: p.title,
    colorName: p.colorName,
    unitCostMinor: p.costMinor,
    isDark: p.isDark,
    available: p.available,
  }));
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

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3 py-sp-6">
          {QUICK_PATHS.map((p) => (
            <Link
              key={p.num}
              href={p.href}
              className="bg-bg-raised border border-border rounded-md p-sp-4 hover:border-accent hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-sm">
                  {p.num}
                </span>
                <span className="text-text-tertiary" aria-hidden>
                  →
                </span>
              </div>
              <h3 className="mt-sp-3 mb-1.5 text-lg font-display font-bold">
                {p.title}
              </h3>
              <p className="text-sm text-text-secondary m-0">{p.body}</p>
            </Link>
          ))}
        </div>
      </Container>

      <Reveal>
        <WalkTheFloor />
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

      <Reveal>
        <section id="quote" className="py-sp-8">
          <Container>
            <QuoteBuilder
              pricingConfig={pricingConfig}
              catalogProducts={
                catalogProducts.length > 0 ? catalogProducts : undefined
              }
            />
          </Container>
        </section>
      </Reveal>

      <StatsBand />
      <CtaBand />
    </>
  );
}
