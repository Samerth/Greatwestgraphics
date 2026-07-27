"use client";

import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";
import { useCartStore, computeCartTotals } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const totals = computeCartTotals(items);

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
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
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
                      <div className="flex items-center border border-border rounded-full overflow-hidden w-fit">
                        <button
                          aria-label="Decrease quantity"
                          className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                          onClick={() => updateQty(item.id, item.color, item.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-11 text-center font-bold text-[13.5px]">
                          {item.qty}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                          onClick={() => updateQty(item.id, item.color, item.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="text-[12.5px] font-semibold text-text-tertiary hover:text-accent transition-colors"
                        onClick={() => removeItem(item.id, item.color)}
                      >
                        Remove
                      </button>
                    </div>
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
                items={[
                  { slug: "drinkware-mugs", name: "Drinkware", meta: "11oz ceramic — from $3.20", artIndex: 8 },
                  { slug: "caps-beanies", name: "Caps", meta: "Custom woven — from $2.10", artIndex: 11 },
                  { slug: "stickers-decals", name: "Sticker Sheets", meta: "Die-cut, weatherproof — from $1.85", artIndex: 9 },
                ]}
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