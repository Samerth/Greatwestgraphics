"use client";

import { useMemo } from "react";
import type { PricingConfigV2 } from "@gwg/contracts";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import {
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
} from "@/lib/utils/shop-quote";
import type { DbVariantOption } from "@/components/pdp/DbProductActions";
import { usePdpLiveEstimate } from "@/lib/store/pdp-live-estimate";
import { priceStorefrontQuote } from "@/lib/commerce/storefront-quote";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";

export function PdpStartingPrice({
  productId,
  name,
  color,
  variants,
  pricingConfig,
}: {
  productId: string;
  name: string;
  color: string;
  variants: DbVariantOption[];
  pricingConfig?: PricingConfigV2 | null;
}) {
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];

  // The Live Estimate Calculator below (PdpDetailedQuote) publishes its own
  // quantity-break pricing on every recompute. Prefer that here whenever it's
  // for this product, so this headline tracks the customer's actual current
  // decoration/quantity selection instead of a second, independently
  // guessed default. Falls back to a same-shaped default-decoration
  // calculation only for the brief moment before the calculator has
  // published (or if it's absent from the page entirely).
  const liveBreaks = usePdpLiveEstimate((s) =>
    s.productId === productId ? s.quantityBreaks : null,
  );
  const liveCurrent = usePdpLiveEstimate((s) =>
    s.productId === productId ? s.current : null,
  );

  const fallback = useMemo(() => {
    if (!pricingConfig || !firstInStock?.costMinor) return null;
    const methods = enabledDecorationMethods(pricingConfig);
    const defaultMethodKey =
      methods.find((m) => m.key === pricingConfig.storefront?.defaultMethodKey)
        ?.key ??
      methods[0]?.key ??
      "";
    const method = methods.find((m) => m.key === defaultMethodKey);
    if (!method) return null;
    const fields = methodVariableInputs(method);
    const anchorQty = method.rateModel.qtyAnchors[0] ?? 48;

    // Shares one request builder with the calculator below and with the
    // catalogue card, so this headline cannot quote on different assumptions
    // from the price the customer is about to see (UAT V2 row 53).
    try {
      const { unitMinor } = priceStorefrontQuote(pricingConfig, {
        description: name,
        unitCostMinor: firstInStock.costMinor,
        quantity: anchorQty,
        colourName: color,
        mapPriceMinor: firstInStock.mapPriceMinor ?? null,
        decorations: [
          {
            id: "starting-price",
            methodKey: defaultMethodKey,
            location: pricingConfig.storefront?.defaultLocation ?? "front",
            ...(fields.colours
              ? { colours: pricingConfig.storefront?.defaultColours ?? 1 }
              : {}),
            ...(fields.stitches
              ? { stitchCount: stitchCountForPreset("medium") }
              : {}),
            ...(fields.option ? { optionKey: defaultOptionKey(method) } : {}),
          },
        ],
      });
      return [{ qty: anchorQty, unitMinor }];
    } catch {
      return null;
    }
  }, [pricingConfig, firstInStock, name, color]);

  const quantityBreaks =
    liveBreaks && liveBreaks.length > 0 ? liveBreaks : fallback;

  // Track what the calculator is actually showing. Falling back to
  // `quantityBreaks[0]` meant this headline quoted the *smallest* break —
  // the dearest price on the page — while the calculator below showed the
  // customer's real quantity. Two prices, both correct, that read as a
  // contradiction.
  const starting = liveCurrent ?? quantityBreaks?.[0] ?? null;

  if (!starting) return null;

  return (
    <div className="mt-sp-3">
      <p className="text-lg font-bold m-0">
        Estimated from {moneyFromMinor(starting.unitMinor)} CAD each at{" "}
        {starting.qty} pieces
      </p>
      <div className="mt-1">
        <PricingDetailsPopover
          quantityBreaks={quantityBreaks ?? []}
          heading="Quantity breaks (this selection)"
          triggerContent="Pricing Details"
          triggerClassName="text-sm font-bold text-accent underline underline-offset-2"
        />
      </div>
    </div>
  );
}
