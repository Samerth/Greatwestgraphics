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
import { decorationSummary } from "@/lib/commerce/decoration-summary";
import { priceStorefrontQuote } from "@/lib/commerce/storefront-quote";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";

export function PdpStartingPrice({
  productId,
  name,
  color,
  variants,
  pricingConfig,
  isHat = false,
}: {
  productId: string;
  name: string;
  color: string;
  variants: DbVariantOption[];
  pricingConfig?: PricingConfigV2 | null;
  /** Headwear defaults to embroidery instead of the site's configured
   *  screen-print default — see catalog-card.ts, which this mirrors. */
  isHat?: boolean;
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
  const liveSummary = usePdpLiveEstimate((s) =>
    s.productId === productId ? s.summary : null,
  );

  const fallback = useMemo(() => {
    if (!pricingConfig || !firstInStock?.costMinor) return null;
    const methods = enabledDecorationMethods(pricingConfig);
    const defaultMethodKey =
      (isHat ? methods.find((m) => m.key === "embroidery")?.key : undefined) ??
      methods.find((m) => m.key === pricingConfig.storefront?.defaultMethodKey)
        ?.key ??
      methods[0]?.key ??
      "";
    const method = methods.find((m) => m.key === defaultMethodKey);
    if (!method) return null;
    const fields = methodVariableInputs(method);
    const anchorQty = method.rateModel.qtyAnchors[0] ?? 48;

    // One selection object, used for both the price and the sentence under
    // it, so the headline can never describe a decoration it didn't price.
    const location = pricingConfig.storefront?.defaultLocation ?? "front";
    const colours = fields.colours
      ? (pricingConfig.storefront?.defaultColours ?? 1)
      : undefined;
    const stitchPreset = fields.stitches ? ("medium" as const) : undefined;

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
            location,
            ...(colours !== undefined ? { colours } : {}),
            ...(stitchPreset
              ? { stitchCount: stitchCountForPreset(stitchPreset) }
              : {}),
            ...(fields.option ? { optionKey: defaultOptionKey(method) } : {}),
          },
        ],
      });
      return {
        breaks: [{ qty: anchorQty, unitMinor }],
        summary: decorationSummary(
          [{ methodKey: defaultMethodKey, location, colours, stitchPreset }],
          methods,
        ),
      };
    } catch {
      return null;
    }
  }, [pricingConfig, firstInStock, name, color, isHat]);

  const quantityBreaks =
    liveBreaks && liveBreaks.length > 0 ? liveBreaks : (fallback?.breaks ?? null);
  // The calculator's own sentence wins once it has published; the default
  // assumption only covers the moment before that (or a page without it).
  const summary = liveSummary ?? fallback?.summary ?? null;

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
        {starting.qty} {starting.qty === 1 ? "piece" : "pieces"}
      </p>
      {summary && (
        <p className="text-sm text-text-secondary m-0 mt-1">{summary}</p>
      )}
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
