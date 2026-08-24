import type { Metadata } from "next";
import { normalizeDesignDocument } from "@gwg/contracts";
import { Container } from "@/components/shared/Container";
import { DesignStudio, type SavedDesignProject } from "@/components/design/DesignStudio";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";
import { getCustomerSession } from "@/lib/auth/session";
import { createCommerceClient } from "@/lib/commerce/client";

// Session and ?loadDesignId= are per-visitor. Caching this page served one
// customer's saved design (or an empty studio) to the next.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Design Studio — Upload & Preview Your Artwork Live",
  description:
    "Upload your logo or artwork and preview it live on real garments before you order. Move, scale and rotate your design and see the mockup update instantly.",
  alternates: { canonical: "/design" },
};

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ loadDesignId?: string; garmentId?: string }>;
}) {
  const { loadDesignId, garmentId } = await searchParams;
  const [catalog, session, pricingConfig] = await Promise.all([
    // Grouped by style so 150 rows are 150 garments, not 150 Adidas
    // colourways. Colour switching uses the product-detail colorways list.
    loadStorefrontCatalog({ limit: 150 }),
    getCustomerSession(),
    loadPublishedPricingV2(),
  ]);
  const garments = catalog.products
    .filter((p) => p.available)
    .map((p) => ({
      id: p.id,
      label: p.name,
      colorName: p.colorName,
      brandName: p.brandName,
      styleName: p.styleName,
      imageUrl: p.imageUrl,
      sideImageUrl: p.sideImageUrl,
      backImageUrl: p.backImageUrl,
      isDark: p.isDark,
      slug: p.slug,
      costMinor: p.costMinor,
    }));

  let initialDesign: SavedDesignProject | null = null;
  if (loadDesignId && session) {
    try {
      const row = await (await createCommerceClient()).getDesignProject(loadDesignId);
      initialDesign = {
        id: String(row.id),
        name: String(row.name),
        garmentProductId: row.garmentProductId ? String(row.garmentProductId) : null,
        // The API already migrates whichever generation of row this is into
        // the current document, but normalize again so a response from an
        // older API build still loads rather than rendering an empty studio.
        design: normalizeDesignDocument(row.design ?? row),
      };
    } catch {
      initialDesign = null;
    }
  }

  return (
    <>
      <section className="bg-text-primary text-white pt-sp-7 pb-sp-6 relative overflow-hidden">
        <Container className="relative">
          <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            The AI Design Studio
          </div>
          <h1 className="font-display font-bold text-display leading-display max-w-[14ch] text-white">
            Design it live. <span className="text-accent">Watch the mockup update</span> as
            you go.
          </h1>
          <p className="mt-sp-3 max-w-[52ch] text-white/75 text-[16px] leading-[1.6]">
            Upload a logo or artwork and place it on the garment.
            The live mockup updates the second you move, scale or rotate a layer.
          </p>
        </Container>
      </section>

      <section className="py-sp-7">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-4">
            Home / <b className="text-text-primary">Design Studio</b>
          </div>
          <DesignStudio
            garments={garments}
            signedIn={Boolean(session)}
            initialDesign={initialDesign}
            garmentIdOverride={garmentId ?? null}
            pricingConfig={pricingConfig}
          />
        </Container>
      </section>

      <section id="art-guidelines" className="py-sp-8 border-t border-border scroll-mt-28">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-[0.7fr_1.3fr] gap-sp-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                Artwork guidelines
              </span>
              <h2 className="font-display text-header font-bold mt-sp-2">
                Files that print cleanly.
              </h2>
              <p className="text-text-secondary mt-sp-2">
                Start with the highest-quality source you have. Our team reviews every
                production file before anything reaches the press.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-sp-3">
              {[
                ["Preferred", "Vector PDF, AI or SVG with outlined fonts."],
                ["Also accepted", "Transparent PNG at 300 DPI and final print size."],
                ["Avoid", "Screenshots, compressed logos and images copied from websites."],
              ].map(([title, copy]) => (
                <div key={title} className="rounded-lg border border-border bg-bg-raised p-sp-4">
                  <h3 className="font-display font-bold">{title}</h3>
                  <p className="text-sm text-text-secondary mt-sp-2">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
