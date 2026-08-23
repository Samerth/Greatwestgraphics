import type { PricingConfigV2 } from "@gwg/contracts";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import { createCommerceClient } from "./client";

/**
 * Published v2 rates for every storefront calculator. Falls back to the
 * bundled master so /quote and /design still price when commerce-api is down.
 */
export async function loadPublishedPricingV2(): Promise<PricingConfigV2> {
  try {
    const published = await (
      await createCommerceClient()
    ).getPublishedPricingV2Config();
    return published.config;
  } catch (caught) {
    console.error(
      "[storefront] published pricing unavailable; using bundled defaults",
      caught instanceof Error ? caught.message : caught,
    );
    return PRICING_MASTER_V2;
  }
}
