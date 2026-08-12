"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CrossSellGrid, type CrossSellItem } from "@/components/shared/CrossSellGrid";
import { useCartStore, computeCartTotals, type CartItem } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";
import { RosterTable } from "@/components/shared/RosterTable";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";

const SAVED_KEY = "gwg-cart-saved";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const totals = computeCartTotals(items);

  const [mounted, setMounted] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoNote, setPromoNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<CartItem[]>([]);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw) as CartItem[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      // ignore
    }
  }, [saved, mounted]);

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

  function saveForLater(item: CartItem) {
    setSaved((prev) => {
      const key = `${item.id}-${item.color}-${item.variantId ?? ""}`;
      if (prev.some((p) => `${p.id}-${p.color}-${p.variantId ?? ""}` === key)) {
        return prev;
      }
      return [...prev, item];
    });
    removeItem(item.id, item.color, item.variantId);
  }

  function moveSavedToCart(item: CartItem) {
    addItem(item);
    setSaved((prev) =>
      prev.filter(
        (p) =>
          !(
            p.id === item.id &&
            p.color === item.color &&
            p.variantId === item.variantId
          ),
      ),
    );
  }

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <section className="py-sp-8">
        <Container className="text-center">
          <p className="text-sm text-text-tertiary mb-sp-4">
            <Link href="/" className="hover:text-accent">
              Home
            </Link>{" "}
            /{" "}
            <Link href="/products" className="hover:text-accent">
              Shop
            </Link>{" "}
            / Cart
          </p>
          <h1 className="font-display font-bold text-header mb-sp-2">
            Your cart is empty.
          </h1>
          <p className="text-text-secondary mb-sp-4">
            Add a product and it&apos;ll show up here, ready to size, colour and
            quote.
          </p>
          <ButtonLink href="/products">Browse the Shop</ButtonLink>
          {saved.length > 0 && (
            <div className="mt-sp-7 text-left max-w-2xl mx-auto">
              <h2 className="font-display font-bold text-lg mb-sp-3">
                Saved for later
              </h2>
              <div className="space-y-3">
                {saved.map((item) => (
                  <div
                    key={`${item.id}-${item.color}-saved`}
                    className="flex justify-between gap-3 border border-border rounded-md p-sp-3 bg-bg-raised"
                  >
                    <div>
                      <p className="font-bold m-0">{item.name}</p>
                      <p className="text-sm text-text-tertiary m-0 mt-1">
                        {item.meta} · {item.color}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-bold text-accent"
                      onClick={() => moveSavedToCart(item)}
                    >
                      Move to cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Container>
      </section>
    );
  }

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-sm text-text-tertiary mb-sp-4">
          <Link href="/" className="hover:text-accent">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/products" className="hover:text-accent">
            Shop
          </Link>{" "}
          / Cart
        </p>
        <h1 className="font-display font-bold text-header mb-sp-6">Your Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-sp-6 items-start">
          <div className="space-y-sp-3">
            {items.map((item) => (
              <div
                key={`${item.id}-${item.color}`}
                className="flex flex-col sm:flex-row gap-sp-4 border border-border rounded-md p-sp-4 bg-bg-raised"
              >
                <div className="relative w-full sm:w-28 h-28 shrink-0 rounded-md overflow-hidden bg-fill-subtle">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover object-top"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start justify-between gap-sp-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-[15.5px] mb-1.5 truncate">
                      {item.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-tertiary mb-sp-3">
                      <span>{item.meta}</span>
                      <span className="text-border">·</span>
                      <span>{item.color}</span>
                      <span className="text-border">·</span>
                      <span>{item.qty.toLocaleString()} pieces</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {item.roster ? (
                        <span className="text-[13.5px] font-bold text-text-secondary">
                          {item.qty} pieces · team order
                        </span>
                      ) : (
                        <div className="flex items-center border border-border rounded-full overflow-hidden w-fit">
                          <button
                            aria-label="Decrease quantity"
                            className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                            onClick={() =>
                              updateQty(
                                item.id,
                                item.color,
                                item.qty - 1,
                                item.variantId,
                              )
                            }
                          >
                            −
                          </button>
                          <span className="w-11 text-center font-bold text-[13.5px]">
                            {item.qty}
                          </span>
                          <button
                            aria-label="Increase quantity"
                            className="w-8 h-8 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
                            onClick={() =>
                              updateQty(
                                item.id,
                                item.color,
                                item.qty + 1,
                                item.variantId,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-sp-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
                      <Link
                        href={
                          item.productId
                            ? `/product/${encodeURIComponent(item.id)}?id=${item.productId}`
                            : `/products`
                        }
                        className="text-text-tertiary hover:text-accent transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="text-text-tertiary hover:text-accent transition-colors"
                        onClick={() =>
                          removeItem(item.id, item.color, item.variantId)
                        }
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="text-text-tertiary hover:text-accent transition-colors"
                        onClick={() => saveForLater(item)}
                      >
                        Save for later
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

            <div className="border border-border rounded-md p-sp-3 bg-bg text-sm text-text-secondary">
              <p className="font-bold text-text-primary m-0 mb-1">
                Estimated Timeline
              </p>
              Digitizing &amp; proof: 1–2 days · Production: 5–7 business days ·
              Shipping: 2–3 days
            </div>

            {saved.length > 0 && (
              <div className="pt-sp-3">
                <h2 className="font-display font-bold text-lg mb-sp-3">
                  Saved for later
                </h2>
                <div className="space-y-3">
                  {saved.map((item) => (
                    <div
                      key={`${item.id}-${item.color}-saved`}
                      className="flex justify-between gap-3 border border-border rounded-md p-sp-3 bg-bg-raised"
                    >
                      <div>
                        <p className="font-bold m-0">{item.name}</p>
                        <p className="text-sm text-text-tertiary m-0 mt-1">
                          {item.meta} · {item.color}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-bold text-accent"
                        onClick={() => moveSavedToCart(item)}
                      >
                        Move to cart
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-sp-5">
              <CrossSellGrid
                title="You Might Also Like"
                items={crossSellItems.length > 0 ? crossSellItems : undefined}
              />
            </div>
          </div>

          <div className="border border-border rounded-md p-sp-5 bg-bg-raised lg:sticky lg:top-[100px]">
            <h2 className="font-display font-bold text-[17px] mb-sp-4">
              Order Summary
            </h2>
            <div className="space-y-0.5">
              <SummaryRow
                label={`Subtotal (${totals.pieces.toLocaleString()} pieces)`}
                value={money(totals.subtotal)}
              />
              <SummaryRow label="Setup & digitizing" value="Included" />
              {totals.discount > 0 && (
                <SummaryRow
                  label="Volume tier discount"
                  value={`-${money(totals.discount)}`}
                  accent
                />
              )}
              <SummaryRow label="Shipping (Vancouver)" value="Free" />
            </div>

            <form
              className="mt-sp-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPromoNote(
                  promo.trim()
                    ? "Promo codes are applied by your rep at quote confirmation."
                    : "Enter a promo code to continue.",
                );
              }}
            >
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                placeholder="Promo code"
                className="flex-1 border border-border rounded-sm px-3 py-2 text-sm bg-white"
                aria-label="Promo code"
              />
              <button
                type="submit"
                className="border border-border rounded-sm px-3 py-2 text-sm font-bold hover:border-accent hover:text-accent transition-colors"
              >
                Apply
              </button>
            </form>
            {promoNote ? (
              <p className="text-[12px] text-text-tertiary mt-2 mb-0">
                {promoNote}
              </p>
            ) : null}

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
              Request Quote
            </Link>
            <p className="text-[12px] text-text-tertiary text-center mt-sp-3 mb-1">
              🔒 Secure checkout · Visa · Mastercard · Amex
            </p>
            <p className="text-[12px] text-text-tertiary text-center m-0">
              Per-piece pricing improves as your quantity goes up.
            </p>
          </div>
        </div>

        <div className="mt-sp-7 flex flex-wrap justify-center gap-x-sp-5 gap-y-2 text-sm text-text-secondary border border-border rounded-md py-3 px-4 bg-bg-raised">
          <span>✓ Proof before print</span>
          <span>✓ Reprint guarantee</span>
          <span>✓ Quick Order 48-hour available</span>
          <span>✓ Vancouver made since 1980</span>
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
