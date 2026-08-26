import type { PricingConfigV2 } from "@gwg/contracts";
import {
  priceShopperItem,
  type ShopperPriceInput,
  type ShopperPriceSummary,
} from "@gwg/pricing";

/**
 * Shopper-facing unit price. Same helper the admin shopper-price tab uses.
 */
export function shopperUnitMinor(
  config: PricingConfigV2,
  input: ShopperPriceInput,
): number {
  return priceShopperItem(config, input).summary.unitMinor;
}

export function shopperPriceSummary(
  config: PricingConfigV2,
  input: ShopperPriceInput,
): ShopperPriceSummary {
  return priceShopperItem(config, input).summary;
}


export type RosterCostVariant = {
  sizeName: string;
  unitCostMinor?: number | null;
  mapPriceMinor?: number | null;
};

export type RosterCostResult = {
  unitCostMinor: number;
  mapPriceMinor: number | null;
  quantity: number;
  /** True when at least one roster size resolved to a real variant cost. */
  matched: boolean;
};

/**
 * A mixed-size team order costs what the actual sizes cost, not what row 1
 * costs. We blend by quantity into ONE line rather than splitting per size,
 * because calculateQuoteV2 applies quantity breaks per garment entry — a
 * split would drop each size into a small-run tier and over-charge the team.
 * MAP floor takes the highest matched size so no size is sold under floor.
 */
export function rosterWeightedCostMinor(
  rows: { size: string }[],
  variants: RosterCostVariant[],
  fallback: { unitCostMinor: number; mapPriceMinor?: number | null },
): RosterCostResult {
  if (rows.length === 0) {
    return {
      unitCostMinor: fallback.unitCostMinor,
      mapPriceMinor: fallback.mapPriceMinor ?? null,
      quantity: 0,
      matched: false,
    };
  }
  let costTotal = 0;
  let matched = false;
  let mapFloor: number | null = fallback.mapPriceMinor ?? null;
  for (const row of rows) {
    const variant = variants.find((candidate) => candidate.sizeName === row.size);
    const cost = variant?.unitCostMinor ?? null;
    if (cost && cost > 0) {
      matched = true;
      costTotal += cost;
      if (variant?.mapPriceMinor != null) {
        mapFloor = Math.max(mapFloor ?? 0, variant.mapPriceMinor);
      }
    } else {
      costTotal += fallback.unitCostMinor;
    }
  }
  return {
    unitCostMinor: Math.round(costTotal / rows.length),
    mapPriceMinor: mapFloor,
    quantity: rows.length,
    matched,
  };
}
