import { Hero } from "@/components/home/Hero";
import { Container } from "@/components/shared/Container";
import { Reveal } from "@/components/shared/Reveal";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";
import { WalkTheFloor } from "@/components/home/WalkTheFloor";
import { FabricWall } from "@/components/home/FabricWall";
import { BestsellerRoller } from "@/components/home/BestsellerRoller";
import {
  TrustStrip,
  Testimonials,
  Gallery,
  StatsBand,
  CtaBand,
} from "@/components/home/StaticSections";
import { ProductsGrid } from "@/components/products/ProductsGrid";
import { DEFAULT_PRICING_CONFIG_V1 } from "@/lib/utils/quote-pricing";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import type { PricingConfig } from "@gwg/contracts";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Only names GWG's real, confirmed clients (per their own site) or a
// generic, non-attributed job description — never a specific named
// organization we have no evidence actually ordered from GWG.
const GALLERY_LABELS = [
  { name: "Marriott", meta: "Staff uniforms · embroidered" },
  { name: "Fujitsu", meta: "Corporate polos · branded" },
  { name: "St. George's School", meta: "Athletics hoodies · 3-colour" },
  { name: "Grande West", meta: "Crew tees · branded" },
  { name: "Local nonprofit", meta: "Canvas totes · benefit run" },
  { name: "Community event", meta: "Staff tees · rush order" },
  { name: "Trade & safety crew", meta: "Hi-vis hoodies · CSA" },
  { name: "Corporate client", meta: "Uniform run · repeat order" },
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
    // The catalog is sorted brand-then-style alphabetically, and Adidas
    // alone has 170 colourways — a small limit here would silently only
    // ever offer Adidas. 150 is a deliberately conservative trade-off:
    // spans a few brands while staying fast — this is a stopgap, not a
    // substitute for the real pagination /products has.
    loadStorefrontCatalog({ limit: 150 }),
  ]);
  const preferDb = catalog.source === "db" || catalog.source === "empty";
  const catalogProducts = quoteCatalog.products.map((p) => ({
    id: p.id,
    label: `${p.brandName} ${p.styleName} · ${p.colorName}`.trim(),
    brandName: p.brandName,
    styleName: p.styleName,
    colorName: p.colorName,
    unitCostMinor: p.costMinor,
    isDark: p.isDark,
    available: p.available,
  }));
  // One representative colourway per style, so "bestsellers" and the
  // gallery show a variety of garments rather than the same shirt five
  // times over in different colours.
  const seenStyles = new Set<string>();
  const withPhoto = catalog.products.filter((p) => {
    if (!p.available || !p.imageUrl) return false;
    const styleKey = `${p.brandName}::${p.styleName}`;
    if (seenStyles.has(styleKey)) return false;
    seenStyles.add(styleKey);
    return true;
  });
  const bestsellerItems = withPhoto.slice(0, 8).map((p, index) => ({
    slug: p.slug,
    name: p.name,
    price: p.priceFrom,
    artIndex: index + 1,
    imageUrl: p.imageUrl,
    href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
  }));
  const galleryItems = GALLERY_LABELS.map((label, index) => ({
    ...label,
    artIndex: index + 1,
    imageUrl: withPhoto[(index + 8) % Math.max(withPhoto.length, 1)]?.imageUrl,
  }));

  return (
    <>
      <Hero />

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3 -mt-14 relative z-[5]">
          {QUICK_PATHS.map((p) => (
            <Link
              key={p.num}
              href={p.href}
              className="bg-bg-raised border border-border rounded-lg p-sp-4 shadow-card hover:shadow-card-hover hover:border-accent hover:-translate-y-0.5 transition-all"
            >
              <span className="inline-flex text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-sm">
                {p.num}
              </span>
              <h3 className="mt-sp-3 mb-1.5 text-lg font-display font-bold">{p.title}</h3>
              <p className="text-sm text-text-secondary">{p.body}</p>
            </Link>
          ))}
        </div>
      </Container>

      <Reveal>
        <WalkTheFloor />
      </Reveal>

      <Reveal>
        <FabricWall />
      </Reveal>

      <TrustStrip />

      <Reveal>
        <BestsellerRoller items={bestsellerItems.length > 0 ? bestsellerItems : undefined} />
      </Reveal>

      <Reveal>
        <section
          className="py-sp-8 relative"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #FFF7F1 45%, #F5B48A 80%, #AA3300 100%)",
          }}
        >
          <Container>
            <div className="mb-sp-5">
              <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                The Product Universe
              </div>
              <h2 className="font-display font-bold text-header leading-header max-w-[24ch]">
                Crafting every <span className="text-accent">Print</span>, Stitch &amp;
                Press with precision.
              </h2>
              <p className="text-text-secondary max-w-[60ch] mt-sp-2">
                Real products, real methods, real starting prices. Filter by what you need.
              </p>
            </div>
            <ProductsGrid
              preferDb={preferDb}
              // A short, diverse preview (one colourway per style) rather
              // than dumping the full 120-item fetch here — apparel alone
              // outnumbers every other category by 10-100x in the real
              // catalog, so an unfiltered/uncapped grid on the homepage
              // reads as an endless apparel wall with no way to page
              // through it. Full browsing + real pagination lives on
              // /products; this section's job is to preview and funnel
              // there, not duplicate it.
              dbProducts={withPhoto.slice(0, 24)}
              dbCategories={catalog.categories}
            />
            <div className="mt-sp-5 flex justify-center">
              <Link
                href="/products"
                className="inline-block rounded-md border border-border bg-bg-raised font-bold text-sm px-5 py-3 hover:border-accent hover:text-accent transition-colors"
              >
                View Full Catalogue →
              </Link>
            </div>
          </Container>
        </section>
      </Reveal>

      <Reveal>
        <Testimonials />
      </Reveal>

      <Reveal>
        <section className="py-sp-8">
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

      <Reveal>
        <Gallery items={galleryItems} />
      </Reveal>

      <StatsBand />
      <CtaBand />
    </>
  );
}
