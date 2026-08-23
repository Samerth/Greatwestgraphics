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
