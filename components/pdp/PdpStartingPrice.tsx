"use client";

import { useMemo } from "react";
import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import {
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
} from "@/lib/utils/shop-quote";
import type { DbVariantOption } from "@/components/pdp/DbProductActions";
import { usePdpLiveEstimate } from "@/lib/store/pdp-live-estimate";
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

    const input: QuoteInputV2 = {
      garments: [
        {
          id: "g1",
          description: name,
          unitCostMinor: firstInStock.costMinor,
          quantity: anchorQty,
          colourName: color,
          mapPriceMinor: firstInStock.mapPriceMinor ?? undefined,
        },
      ],
      decorations: [
        {
          id: "starting-price",
          garmentId: "g1",
          methodKey: defaultMethodKey,
          location: pricingConfig.storefront?.defaultLocation ?? "front",
          logoGroup: "",
          colours: fields.colours
            ? pricingConfig.storefront?.defaultColours ?? 1
            : undefined,
          variableValue: fields.stitches
            ? stitchCountForPreset("medium")
            : undefined,
          optionKey: fields.option ? defaultOptionKey(method) : undefined,
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

    try {
      const breakdown = calculateQuoteV2(input, pricingConfig);
      return [{ qty: anchorQty, unitMinor: Math.round(breakdown.totals.totalMinor / anchorQty) }];
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
