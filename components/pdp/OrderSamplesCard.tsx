"use client";

import { useEffect, useState } from "react";
import type { PricingConfigV2 } from "@gwg/contracts";
import type { DbVariantOption } from "@/components/pdp/DbProductActions";
import { OrderSampleForm } from "@/components/pdp/OrderSampleForm";

/**
 * Small "Order a Sample" entry point on the PDP (CodSphere UAT V2, "Product
 * Page / Live Quote UI Needs to Be Updated" row, items 15–16). Replaces the
 * large always-open roster/quantity/cart section that used to sit under the
 * Live Estimate Calculator. The popup renders OrderSampleForm — a
 * lightweight Colour → Size → Quantity → Add Sample to Cart flow built for
 * this specifically, not the full bulk/team-order component that used to
 * live in this section. No pricing logic changed — same engine, smaller UI.
 */
export function OrderSamplesCard({
  productId,
  styleId,
  name,
  color,
  image,
  variants,
  productSlug,
  pricingConfig,
  available = true,
}: {
  productId: string;
  styleId: string;
  name: string;
  color: string;
  image: string | null;
  variants: DbVariantOption[];
  productSlug?: string;
  pricingConfig?: PricingConfigV2 | null;
  available?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  if (variants.length === 0) return null;

  return (
    <span className="inline-flex">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 font-bold text-accent hover:underline"
      >
        Order a Sample
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[80]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[81] flex items-end lg:items-center lg:justify-center p-0 lg:p-4">
            <div className="bg-bg-raised w-full lg:w-full lg:max-w-lg rounded-t-lg lg:rounded-lg border border-border lg:shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-bg-raised border-b border-border px-sp-5 py-sp-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg m-0">Order a Sample</h2>
                  <p className="text-xs text-text-tertiary mt-0.5 m-0">
                    {name} · {color}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-text-tertiary hover:text-text-primary transition-colors text-2xl leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="px-sp-5 py-sp-4">
                {available ? (
                  <OrderSampleForm
                    productId={productId}
                    productSlug={productSlug}
                    styleId={styleId}
                    name={name}
                    color={color}
                    image={image}
                    pricingConfig={pricingConfig}
                    variants={variants}
                    onAdded={() => setOpen(false)}
                  />
                ) : (
                  <p className="text-text-secondary text-sm m-0">
                    This colour is currently unavailable.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}