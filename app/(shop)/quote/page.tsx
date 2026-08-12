import type { Metadata } from "next";
import { Container } from "@/components/shared/Container";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import type { PricingConfigV2 } from "@gwg/contracts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get an Instant Print Quote",
  description:
    "Build a live custom print quote — choose a product, quantity and decoration method (screen printing, embroidery or DTF) and see instant estimated pricing.",
  alternates: { canonical: "/quote" },
};

/**
 * Marketing links use friendly names ("?method=screen"), while the config
 * keys them however the admin named them, so match on both.
 */
function parseMethod(
  raw: string | undefined,
  config: PricingConfigV2,
): string | undefined {
  if (!raw) return undefined;
  const wanted = raw.toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<string, string> = {
    screen: "screenprint",
    screenprinting: "screenprint",
    stitching: "embroidery",
    transfer: "dtf",
  };
  const target = aliases[wanted] ?? wanted;
  return config.methods.find(
    (method) => method.key.toLowerCase().replace(/[^a-z]/g, "") === target,
  )?.key;
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; type?: string }>;
}) {
  const params = await searchParams;
  let pricingConfig: PricingConfigV2 = PRICING_MASTER_V2;
  let pricingNote: string | undefined;

  try {
    const published = await (
      await createCommerceClient()
    ).getPublishedPricingV2Config();
    pricingConfig = published.config;
  } catch (caught) {
    pricingNote =
      caught instanceof CommerceApiError
        ? "Showing bundled pricing defaults — connect commerce-api for the published config."
        : "Showing bundled pricing defaults.";
  }

  // Sorted brand-then-style alphabetically, and Adidas alone has 170
  // colourways — a small limit would silently only ever offer Adidas.
  // 150 is a conservative trade-off between brand variety and latency.
  const catalog = await loadStorefrontCatalog({ limit: 150 });
  const catalogProducts = catalog.products.map((p) => ({
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

  const initialMethod = parseMethod(params.method, pricingConfig);
  const initialQty =
    params.type?.toLowerCase() === "bulk" ? 250 : undefined;

  return (
    <>
      <section className="pt-sp-8">
        <Container>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Instant planning estimate
          </span>
          <h1 className="font-display font-bold text-display leading-display mt-sp-2 max-w-[16ch]">
            Build a better print quote.
          </h1>
          <p className="text-text-secondary mt-sp-3 max-w-[64ch]">
            Choose a product, quantity and decoration placement to see a live
            estimate. Final pricing is confirmed after artwork review.
          </p>
          {pricingNote && (
            <p className="text-xs text-text-tertiary mt-sp-2">{pricingNote}</p>
          )}
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <QuoteBuilder
            pricingConfig={pricingConfig}
            catalogProducts={
              catalogProducts.length > 0 ? catalogProducts : undefined
            }
            initialMethod={initialMethod}
            initialQty={initialQty}
          />
          <p className="text-xs text-text-tertiary mt-sp-3 max-w-[72ch]">
            Estimates use pricing config v{pricingConfig.version} and exclude tax
            unless noted. One-time setup fees are itemized in the estimate panel.
            {catalogProducts.length > 0
              ? " Garment cost and dark premium come from the local catalog."
              : ""}
          </p>
        </Container>
      </section>
    </>
  );
}
