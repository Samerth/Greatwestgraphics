"use client";

import { useState } from "react";
import type { PricingConfigV2 } from "@gwg/contracts";
import { Button } from "@/components/shared/Button";
import { cn } from "@/lib/utils/cn";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import { useCartStore } from "@/lib/store/cart";
import { unitPriceMinor, type DbVariantOption } from "@/components/pdp/DbProductActions";

/**
 * The lightweight sample-ordering flow inside the "Order a Sample" popup
 * (CodSphere UAT V2, "Product Page / Live Quote UI Needs to Be Updated",
 * item 16 — "Clicking this can then open a popup to order samples based on
 * colour and sizes... Colour → Size → Quantity → Add Sample to Cart").
 *
 * This intentionally does not reuse DbProductActions: that component is the
 * full bulk-blank-order flow (team/roster ordering, a 48-piece default, a
 * custom-quantity "Apply" step, per-piece volume pricing copy) — none of
 * which reads as "ordering a sample" to a customer just checking fit and
 * quality. This is the same pricing engine (unitPriceMinor, unchanged),
 * called at a small quantity, with only the fields a sample order needs.
 *
 * Colour is shown, not chosen: this form only ever sees the variants for the
 * colourway the shopper is already viewing (switching colour on the PDP is
 * already its own navigation between colourway pages), so there is nothing
 * to pick here beyond confirming which colour the sample will be.
 */
export function OrderSampleForm({
  productId,
  styleId,
  name,
  color,
  image,
  variants,
  productSlug,
  pricingConfig,
  onAdded,
}: {
  productId: string;
  styleId: string;
  name: string;
  color: string;
  image: string | null;
  variants: DbVariantOption[];
  productSlug?: string;
  pricingConfig?: PricingConfigV2 | null;
  onAdded?: () => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = variants.find((v) => v.id === variantId);
  const unitMinor = selectedVariant
    ? unitPriceMinor(selectedVariant, qty, pricingConfig, color)
    : 0;

  if (variants.length === 0) {
    return (
      <p className="text-text-secondary text-sm m-0">
        No sizes currently available for this colour.
      </p>
    );
  }

  return (
    <div className="space-y-sp-4">
      <div>
        <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-1">
          Colour
        </span>
        <p className="m-0 text-sm font-semibold">{color}</p>
      </div>

      <div>
        <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
          Size
        </span>
        <div className="flex gap-2 flex-wrap">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={!v.inStock}
              onClick={() => setVariantId(v.id)}
              className={cn(
                "min-w-11 h-10 px-2.5 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                !v.inStock &&
                  "opacity-50 cursor-not-allowed border-amber-300 text-amber-800 bg-amber-50",
                v.inStock &&
                  (v.id === variantId
                    ? "bg-accent text-white border-accent"
                    : "border-border hover:border-text-tertiary"),
              )}
            >
              {v.sizeName}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
          Quantity
        </span>
        <div className="inline-flex items-center border border-border rounded-sm overflow-hidden">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-10 grid place-items-center font-bold text-lg hover:bg-bg-raised transition-colors"
          >
            −
          </button>
          <span className="w-12 text-center font-bold text-sm">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(10, q + 1))}
            className="w-10 h-10 grid place-items-center font-bold text-lg hover:bg-bg-raised transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {selectedVariant && !selectedVariant.inStock && (
        <p className="m-0 text-sm font-semibold text-amber-900">
          Size {selectedVariant.sizeName} is out of stock — pick another size for the sample.
        </p>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={!selectedVariant?.inStock}
        onClick={() => {
          if (!selectedVariant) return;
          addItem({
            id: `sample-${productId}-${selectedVariant.id}`,
            productId,
            productSlug,
            styleId,
            variantId: selectedVariant.id,
            name,
            meta: `Sample · Size ${selectedVariant.sizeName}`,
            color,
            qty,
            unit: unitMinor / 100,
            image: image ?? "",
          });
          trackCartItemAdded({
            id: productId,
            productId,
            name,
            qty,
            unit: unitMinor / 100,
          });
          setJustAdded(true);
          // Let the shopper see the "Added ✓" confirmation for a moment
          // before the popup closes itself, rather than vanishing instantly.
          setTimeout(() => setJustAdded(false), 2000);
          setTimeout(() => onAdded?.(), 900);
        }}
      >
        {!selectedVariant?.inStock
          ? "Unavailable"
          : justAdded
            ? "Added ✓"
            : `Add Sample to Cart · ${moneyFromMinor(unitMinor * qty)}`}
      </Button>
    </div>
  );
}
