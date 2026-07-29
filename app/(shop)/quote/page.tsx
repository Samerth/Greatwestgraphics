import { Container } from "@/components/shared/Container";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { loadStorefrontCatalog } from "@/lib/commerce/catalog";
import { DEFAULT_PRICING_CONFIG_V1 } from "@/lib/utils/quote-pricing";
import type { DecorationMethod, PricingConfig } from "@gwg/contracts";

export const dynamic = "force-dynamic";

function parseMethod(raw?: string): DecorationMethod | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase();
  if (key === "screen" || key === "screenprint") return "screenPrint";
  if (key === "embroidery") return "embroidery";
  if (key === "dtf") return "dtf";
  return undefined;
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; type?: string }>;
}) {
  const params = await searchParams;
  let pricingConfig: PricingConfig = DEFAULT_PRICING_CONFIG_V1;
  let pricingNote: string | undefined;

  try {
    const published = await createCommerceClient().getPublishedPricingConfig();
    pricingConfig = published.config;
  } catch (caught) {
    pricingNote =
      caught instanceof CommerceApiError
        ? "Showing bundled pricing defaults — connect commerce-api for the published config."
        : "Showing bundled pricing defaults.";
  }

  const catalog = await loadStorefrontCatalog({ limit: 40 });
  const catalogProducts = catalog.products.slice(0, 24).map((p) => ({
    id: p.id,
    label: `${p.brandName} ${p.styleName} · ${p.colorName}`.trim(),
    unitCostMinor: p.costMinor,
    isDark: p.isDark,
    available: p.available,
  }));

  const initialMethod = parseMethod(params.method);
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
