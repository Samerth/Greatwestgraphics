import {
  buildShopperQuoteInputMulti,
  calculateQuoteV2,
  type ShopperDecorationInput,
} from "@gwg/pricing";
import type {
  PricingConfigV2,
  QuoteBreakdownV2,
  QuoteInputV2,
} from "@gwg/contracts";

/**
 * The single way a customer-facing price is asked for.
 *
 * There is one pricing engine, and it was never wrong. What was wrong is that
 * five screens each built their own request to it and filled it in slightly
 * differently, so the engine returned five correct answers to five different
 * questions. The same 100-piece order quoted $1,404.00 on the product page and
 * $1,329.00 at the cart — a $75.00 gap that was exactly the individual-packing
 * charge, switched on by the browse screens and off by the one that actually
 * takes the order (CodSphere UAT V2 row 53).
 *
 * Packing was not the only divergence, just the visible one. The hand-built
 * requests also hard-coded `artwork.isRepeat`/`verifiedByStaff` to false and
 * left `isDark` unset, while the shared helper derives all three from the
 * published storefront config — so changing `assumeNewArtwork` or
 * `assumeDarkGarment` in admin would have moved some prices and not others.
 *
 * Every storefront surface now routes through here, so those assumptions are
 * stated once and cannot drift apart again.
 */

/**
 * What a browse-time estimate assumes. Deliberately matches what the order
 * actually charges rather than the other way round: aligning by switching
 * packing *on* everywhere would have silently raised the price customers pay,
 * which is a commercial decision and not ours to make in a bug fix.
 */
export const STOREFRONT_ESTIMATE_ASSUMPTIONS = {
  rush: false,
  includePacking: false,
  shippingCostMinor: 0,
  /**
   * One setup fee per decoration, not one shared across placements. Two prints
   * are two screens, which is what the studio and the order both assume.
   */
  shareSetup: false,
} as const;

export type StorefrontQuoteRequest = {
  description: string;
  unitCostMinor: number;
  quantity: number;
  colourName?: string;
  /** Left undefined lets the engine read darkness off the colour name. */
  isDark?: boolean;
  mapPriceMinor?: number | null;
  decorations: ShopperDecorationInput[];
  /**
   * A real fact about an order rather than an estimating assumption, so this
   * one field may be set — and only the Input Quantity step, which knows
   * whether every piece is named, ever sets it.
   */
  includeNamesNumbers?: boolean;
};

/** The engine request, before it is priced. */
export function storefrontQuoteInput(
  config: PricingConfigV2,
  request: StorefrontQuoteRequest,
): QuoteInputV2 {
  return buildShopperQuoteInputMulti(config, {
    ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
    unitCostMinor: request.unitCostMinor,
    quantity: request.quantity,
    description: request.description,
    decorations: request.decorations,
    ...(request.colourName !== undefined ? { colourName: request.colourName } : {}),
    ...(request.isDark !== undefined ? { isDark: request.isDark } : {}),
    ...(request.mapPriceMinor != null
      ? { mapPriceMinor: request.mapPriceMinor }
      : {}),
    includeNamesNumbers: request.includeNamesNumbers ?? false,
  });
}

export type StorefrontQuote = {
  input: QuoteInputV2;
  breakdown: QuoteBreakdownV2;
  totalMinor: number;
  /**
   * Rounded so `unitMinor * quantity` reads back as the total the customer is
   * shown. Every surface derived this the same way already; centralising it
   * keeps a future change from applying to only some of them.
   */
  unitMinor: number;
};

/**
 * The per-piece figure a customer is shown, with setup folded in.
 *
 * The engine reports a per-piece price that deliberately excludes setup, and a
 * total that includes it — correct for staff, who need to see what each part
 * of a quote costs. Shown to a customer it produced a per-piece price that did
 * not multiply out to the total, and a separate "one-off setup" line they then
 * had to reason about (CodSphere UAT V2 row 48: "consolidate set up into the
 * per unit price, customers do not need to see the set up charges").
 *
 * Staff-facing screens — the pricing admin and its calculator — keep the split
 * and deliberately do not use this.
 */
export function customerUnitMinor(
  totalMinor: number,
  quantity: number,
): number {
  return Math.round(totalMinor / Math.max(1, quantity));
}

/** Price one storefront request. Throws exactly as the engine does. */
export function priceStorefrontQuote(
  config: PricingConfigV2,
  request: StorefrontQuoteRequest,
): StorefrontQuote {
  const input = storefrontQuoteInput(config, request);
  const breakdown = calculateQuoteV2(input, config);
  const quantity = Math.max(1, breakdown.totalQuantity);
  return {
    input,
    breakdown,
    totalMinor: breakdown.totals.totalMinor,
    unitMinor: Math.round(breakdown.totals.totalMinor / quantity),
  };
}

/**
 * Same request priced at each quantity break, for the "from $X at N pieces"
 * tables. Anchors that the engine refuses are dropped rather than guessed at.
 */
export function storefrontQuantityBreaks(
  config: PricingConfigV2,
  request: StorefrontQuoteRequest,
  anchors: readonly number[],
): { qty: number; unitMinor: number }[] {
  const breaks: { qty: number; unitMinor: number }[] = [];
  for (const qty of [...new Set(anchors)].sort((a, b) => a - b)) {
    try {
      breaks.push({
        qty,
        unitMinor: priceStorefrontQuote(config, { ...request, quantity: qty })
          .unitMinor,
      });
    } catch {
      // An anchor outside this method's tiers is not a page-breaking error.
    }
  }
  return breaks;
}

/**
 * Whether a size carries the larger-size garment surcharge vendors apply
 * from 2XL up. The product page warns "2XL+ — additional surcharge, confirmed
 * with your size breakdown"; the quantity step is that breakdown, so it has
 * to say when the surcharge is in the figure. Otherwise a customer watches
 * $44.72 on the product page become $45.59 here with no reason given.
 */
export function isExtendedSize(sizeName: string): boolean {
  const size = sizeName.trim().toLowerCase().replace(/[\s-]+/g, "");
  // "2xl", "3xl" … "6xl"; "xxl", "xxxl" …; "2x", "3x" (some vendors).
  return /^(?:[2-6]xl?|x{2,}l)$/.test(size);
}

export function hasExtendedSizes(
  sizes: readonly { sizeName: string; quantity: number }[],
): boolean {
  return sizes.some((size) => size.quantity > 0 && isExtendedSize(size.sizeName));
}
