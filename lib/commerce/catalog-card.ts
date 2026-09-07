import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import type { StorefrontCatalogProduct } from "./catalog";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { stitchCountForPreset } from "@/lib/utils/shop-quote";

/** Shop-card subtitle: brand, plus a real colourway count when the style has more than one. */
export function catalogCardSubtitle(product: {
  brandName: string;
  colorwayCount?: number | null;
}): string {
  const brand = product.brandName.trim();
  const count = product.colorwayCount ?? 1;
  if (count > 1) {
    return brand ? `${brand} · ${count} colours` : `${count} colours`;
  }
  return brand;
}

export type CardQuantityBreak = { qty: number; unitMinor: number };

export type CardPricing = {
  text: string;
  isEstimate: boolean;
  /** Same method's real quantity tiers, for the hover/click pricing-details
   * popup — empty whenever isEstimate is false (nothing to break down). */
  quantityBreaks: CardQuantityBreak[];
  methodLabel: string | null;
};

/**
 * Catalog card price at the customer's current browsing quantity, priced as
 * a real decorated estimate — 1-colour screen print for most products,
 * embroidery (small logo) for hats, since headwear is conventionally
 * embroidered rather than screen printed. Falls back to the server's blank
 * garment price whenever a decorated estimate can't be computed (no
 * published config, method disabled, no cost on file), rather than showing
 * nothing.
 *
 * Shared by the full catalogue grid (`ProductsGrid.tsx`) and the homepage
 * "Best sellers" teaser (`BestSellers.tsx`) — one implementation, so the
 * same product prices identically wherever its card appears (the UAT fix
 * this was built for was explicit: "no separate pricing logic was
 * introduced").
 */
export function catalogCardPricing(
  product: StorefrontCatalogProduct,
  pricingConfig: PricingConfigV2 | null,
  qty: number,
): CardPricing {
  const empty: CardPricing = {
    text: product.priceFrom,
    isEstimate: false,
    quantityBreaks: [],
    methodLabel: null,
  };
  if (!product.available || !pricingConfig || !product.costMinor) return empty;
  const methodKey = product.isHat ? "embroidery" : "screenPrint";
  const method = pricingConfig.methods.find(
    (m) => m.key === methodKey && m.enabled,
  );
  if (!method) return empty;

  function inputAt(quantity: number): QuoteInputV2 {
    return {
      garments: [
        {
          id: "g1",
          description: product.name,
          unitCostMinor: product.costMinor,
          quantity,
          colourName: product.colorName,
          mapPriceMinor: product.mapPriceMinor ?? undefined,
        },
      ],
      decorations: [
        {
          id: "card-estimate",
          garmentId: "g1",
          methodKey,
          location: "front",
          logoGroup: "",
          colours: methodKey === "screenPrint" ? 1 : undefined,
          variableValue:
            methodKey === "embroidery" ? stitchCountForPreset("small") : undefined,
          isOversized: false,
          artwork: { isRepeat: false, verifiedByStaff: false },
        },
      ],
      options: {
        rush: false,
        includePacking: true,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };
  }

  try {
    const breakdown = calculateQuoteV2(inputAt(qty), pricingConfig);
    const unitMinor = Math.round(breakdown.totals.totalMinor / qty);
    const quantityBreaks = method.rateModel.qtyAnchors
      .map((anchorQty) => {
        try {
          const b = calculateQuoteV2(inputAt(anchorQty), pricingConfig);
          return { qty: anchorQty, unitMinor: Math.round(b.totals.totalMinor / anchorQty) };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is CardQuantityBreak => entry !== null);
    return {
      text: `from ${moneyFromMinor(unitMinor)}`,
      isEstimate: true,
      quantityBreaks,
      methodLabel: methodKey === "screenPrint" ? "1-colour screen print" : "small embroidery",
    };
  } catch {
    return empty;
  }
}
