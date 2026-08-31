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

export function PdpStartingPrice({
  name,
  color,
  variants,
  pricingConfig,
}: {
  name: string;
  color: string;
  variants: DbVariantOption[];
  pricingConfig?: PricingConfigV2 | null;
}) {
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];

  const starting = useMemo(() => {
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
      return {
        unitMinor: Math.round(breakdown.totals.totalMinor / anchorQty),
        qty: anchorQty,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingConfig, firstInStock, name, color]);

  if (!starting) return null;

  return (
    <div className="mt-sp-3">
      <p className="text-lg font-bold m-0">
        Estimated from {moneyFromMinor(starting.unitMinor)} CAD each at{" "}
        {starting.qty} pieces
      </p>
      <button
        type="button"
        onClick={() =>
          document
            .getElementById("live-estimate-calculator")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="mt-1 text-sm font-bold text-accent underline underline-offset-2"
      >
        Pricing Details
      </button>
    </div>
  );
}