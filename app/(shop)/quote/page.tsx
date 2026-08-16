import type { Metadata } from "next";
import Link from "next/link";
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

/**
 * Echoes back the method the visitor asked for when we could not match it.
 *
 * The value comes straight off the query string, so it is clamped to letters
 * and a sane length before it is shown — a link is allowed to name a method,
 * not to write a sentence on the page.
 */
function describeRequestedMethod(raw: string): string | undefined {
  const cleaned = raw.trim().replace(/[^A-Za-z ]/g, "");
  if (!cleaned || cleaned.length > 24) return undefined;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
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
  // A "?method=" the published config has no rates for used to be dropped in
  // silence, so the "Sublimation Printing" tiles on the homepage and in the
  // footer landed on a screen-print estimate that never said so. Say it.
  const unpricedMethod =
    params.method && !initialMethod
      ? describeRequestedMethod(params.method)
      : undefined;
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
          {unpricedMethod && (
            <p
              role="status"
              className="mt-sp-3 max-w-[64ch] rounded-md border border-amber-300 bg-amber-50 p-sp-3 text-sm text-amber-950"
            >
              <b>{unpricedMethod} isn&apos;t on the instant calculator yet.</b>{" "}
              The estimate below is priced with a different method. Tell us what
              you need and we&apos;ll quote {unpricedMethod.toLowerCase()} by
              hand —{" "}
              <Link href="/contact" className="font-bold underline">
                send us the details
              </Link>
              .
            </p>
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
