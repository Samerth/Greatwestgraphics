import type { PricingConfigV2 } from "@gwg/contracts";
import { priceShopperQuote } from "@gwg/pricing";
import { customerUnitMinor } from "@/lib/commerce/storefront-quote";

/** The slice of a catalogue product this needs to price and rank it — a
 *  loose shape rather than `StorefrontCatalogProduct` so callers don't have
 *  to carry the whole catalogue type through. */
export type CheapestMatchCandidate = {
  id: string;
  slug: string;
  label: string;
  colorName: string;
  unitCostMinor: number;
  isDark: boolean;
  available: boolean;
  categorySlugs: string[];
};

export type CheapestMatchRequest = {
  categorySlug: string;
  quantity: number;
  methodKey: string;
  colours?: number;
  stitchCount?: number;
  optionKey?: string;
  locations?: string[];
};

export type CheapestMatchResult = {
  product: CheapestMatchCandidate;
  /** All-in, per piece, at the requested quantity. */
  perPieceMinor: number;
  totalMinor: number;
};

/**
 * The cheapest whole order among every in-stock candidate in the requested
 * category — not the cheapest blank garment. Those aren't always the same
 * product: a dark-garment underbase surcharge, or a hat defaulting to
 * embroidery instead of screen print, both change the total in a way that
 * only pricing each candidate through the real engine catches.
 *
 * Reuses `priceShopperQuote` (the same engine the quote builder and the
 * product page already call) rather than a second, cheaper-but-wrong price
 * comparison — a candidate list is usually a handful to a few dozen
 * products, and the engine is a pure, synchronous calculation, so pricing
 * every one of them costs nothing worth avoiding.
 */
export function cheapestCatalogMatch(
  config: PricingConfigV2,
  candidates: readonly CheapestMatchCandidate[],
  request: CheapestMatchRequest,
): CheapestMatchResult | null {
  const inCategory = candidates.filter(
    (product) => product.available && product.categorySlugs.includes(request.categorySlug),
  );

  let best: CheapestMatchResult | null = null;
  for (const product of inCategory) {
    const quote = priceShopperQuote(config, {
      unitCostMinor: product.unitCostMinor,
      quantity: request.quantity,
      colourName: product.colorName,
      isDark: product.isDark,
      methodKey: request.methodKey,
      colours: request.colours,
      stitchCount: request.stitchCount,
      optionKey: request.optionKey,
      locations: request.locations,
      // One design across every placement — matches the quote builder's own
      // assumption for this same kind of estimate.
      shareSetup: true,
      description: product.label,
      decorated: true,
    });
    const perPieceMinor = customerUnitMinor(quote.totalMinor, request.quantity);
    if (!best || perPieceMinor < best.perPieceMinor) {
      best = { product, perPieceMinor, totalMinor: quote.totalMinor };
    }
  }
  return best;
}
