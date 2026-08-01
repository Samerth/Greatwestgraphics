"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CrossSellGrid, type CrossSellItem } from "@/components/shared/CrossSellGrid";
import { useCartStore, computeCartTotals } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";
import { RosterTable } from "@/components/shared/RosterTable";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const totals = computeCartTotals(items);

  // The cart is persisted to localStorage, which the server can't see, so
  // the server always renders as if the cart were empty. Wait for mount
  // before branching on `items` so the first client render matches the
  // server's — otherwise a returning visitor with items already in their
  // cart sees a hydration error and a flash of the wrong state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [crossSellItems, setCrossSellItems] = useState<CrossSellItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/commerce/catalog/products?limit=12")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: StorefrontCatalogProduct[] } | null) => {
        if (cancelled || !data?.products) return;
        const seenStyles = new Set<string>();
        setCrossSellItems(
          data.products
            .filter((p) => {
              if (!p.available || !p.imageUrl) return false;
              const styleKey = `${p.brandName}::${p.styleName}`;
              if (seenStyles.has(styleKey)) return false;
              seenStyles.add(styleKey);
              return true;
            })
            .slice(0, 3)
            .map((p, index) => ({
              slug: p.slug,
              name: p.name,
              meta: `${p.colorName} · ${p.priceFrom}`,
              artIndex: index + 1,
              imageUrl: p.imageUrl,
              href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
            })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <section className="py-sp-8">
        <Container className="text-center">
          <h1 className="font-display font-bold text-header mb-sp-2">Your cart is empty.</h1>
          <p className="text-text-secondary mb-sp-4">
            Add a product and it&apos;ll show up here, ready to size, colour and quote.
          </p>
          <ButtonLink href="/products">Browse the Shop</ButtonLink>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-sp-8">
      <Container>
        <h1 className="font-display font-bold text-header mb-sp-6">Your Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-sp-6 items-start">
          <div className="space-y-sp-3">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.color}`}
                className="flex flex-col sm:flex-row gap-sp-4 border border-border rounded-lg p-sp-4 bg-bg-raised"
              >
                <div className="relative w-full sm:w-28 h-28 shrink-0 rounded-md overflow-hidden bg-fill-subtle">
                  {item.image && (
                    <Image src={item.image} alt={item.name} fill className="object-cover object-top" />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start justify-between gap-sp-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-[15.5px] mb-1.5 truncate">{item.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-tertiary mb-sp-3">
                      <span>{item.meta}</span>
                      <span className="text-border">·</span>
                      <span>{item.color}</span>
                      <span className="text-border">·</span>
                      <span>{item.qty.toLocaleString()} pieces</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.roster ? (
                        <span className="text-[13.5px] font-bold text-text-secondary">
                          {item.qty} pieces · team order
                        </span>
                      ) : (
                        <div className="flex items-center border border-border rounded-full overflow-hidden w-fit">
                          <button
                            aria-label="Decrease quantity"
                            className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                            onClick={() => updateQty(item.id, item.color, item.qty - 1, item.variantId)}
                          >
                            −
                          </button>
                          <span className="w-11 text-center font-bold text-[13.5px]">
                            {item.qty}
                          </span>
                          <button
                            aria-label="Increase quantity"
                            className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                            onClick={() => updateQty(item.id, item.color, item.qty + 1, item.variantId)}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        className="text-[12.5px] font-semibold text-text-tertiary hover:text-accent transition-colors"
                        onClick={() => removeItem(item.id, item.color, item.variantId)}
                      >
                        Remove
                      </button>
                    </div>

                    {item.roster && (
                      <details className="mt-sp-3">
                        <summary className="text-[12.5px] font-bold text-accent cursor-pointer">
                          View roster ({item.roster.length})
                        </summary>
                        <div className="mt-2">
                          <RosterTable roster={item.roster} />
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="shrink-0 text-right sm:text-right">
                    <div className="text-[11px] uppercase tracking-wide text-text-tertiary font-bold mb-0.5">
                      Line total
                    </div>
                    <div className="font-display font-bold text-[17px]">
                      {money(item.qty * item.unit)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-sp-5">
              <CrossSellGrid
                title="You might also like"
                items={crossSellItems.length > 0 ? crossSellItems : undefined}
              />
            </div>
          </div>

          <div className="border border-border rounded-lg p-sp-5 bg-bg-raised shadow-card lg:sticky lg:top-[100px]">
            <h2 className="font-display font-bold text-[17px] mb-sp-4">Order Summary</h2>
            <div className="space-y-0.5">
              <SummaryRow label={`${totals.pieces.toLocaleString()} pieces subtotal`} value={money(totals.subtotal)} />
              <SummaryRow label="Setup & digitizing" value="Included" />
              {totals.discount > 0 && (
                <SummaryRow label="Volume tier discount" value={`-${money(totals.discount)}`} muted={false} accent />
              )}
              <SummaryRow label="Shipping (Vancouver)" value="Free" />
            </div>
            <div className="flex justify-between items-center border-t border-border mt-sp-3 pt-sp-4 mb-sp-4">
              <span className="font-display font-bold text-[16px]">Total</span>
              <span className="font-display font-bold text-[22px] text-accent">
                {money(totals.netSubtotal)}
              </span>
            </div>
            <ButtonLink href="/checkout" className="w-full">
              Continue to Checkout
            </ButtonLink>
            <Link
              href="/quote"
              className="block text-center mt-2.5 text-sm font-bold border border-border rounded-md py-2.5 hover:bg-fill-subtle-15 transition-colors"
            >
              Request Quote Instead
            </Link>
            <p className="text-[12px] text-text-tertiary text-center mt-sp-3">
              Every order proofed digitally before we print — no surprises.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between py-2 text-[14px] text-text-secondary">
      <span>{label}</span>
      <b className={accent ? "text-accent" : "text-text-primary"}>{value}</b>
    </div>
  );
}