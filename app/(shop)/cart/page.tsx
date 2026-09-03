"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CrossSellGrid, type CrossSellItem } from "@/components/shared/CrossSellGrid";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import { useCartStore, useVisibleCartItems, computeCartTotals, cartItemEditHref, cartLineIsCustomized, type CartItem } from "@/lib/store/cart";
import { money } from "@/lib/utils/quote-pricing";
import { RosterTable } from "@/components/shared/RosterTable";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

const SAVED_KEY = "gwg-cart-saved";

export default function CartPage() {
  const items = useVisibleCartItems();
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const totals = computeCartTotals(items);

  const [mounted, setMounted] = useState(false);
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
    trackCartItemAdded(item);
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
                key={`${item.id}-${item.color}-${item.variantId ?? ""}-${item.designProjectId ?? item.artworkProofUrl ?? "blank"}`}
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
                      {cartLineIsCustomized(item) ? (
                        // Decorated lines (roster or single-item design) are priced
                        // for one specific quantity at add-to-cart time. Letting
                        // qty change here would keep charging that frozen unit
                        // price at a different volume tier — send them back to
                        // Edit to re-quote instead.
                        <span className="text-[13.5px] font-bold text-text-secondary">
                          {item.qty} {item.qty === 1 ? "piece" : "pieces"}
                          {item.roster ? " · team order" : ""} · quantity locked
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
                        href={cartItemEditHref(item)}
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

                    {/* Always visible, not tucked behind a click: this is
                        who each shirt in the order actually goes to. */}
                    {item.roster && (
                      <div className="mt-sp-3">
                        <span className="block text-[12.5px] font-bold text-text-secondary mb-1.5">
                          Names &amp; numbers ({item.roster.length})
                        </span>
                        <RosterTable roster={item.roster} />
                      </div>
                    )}
                    {item.designNotes ? (
                      <p className="mt-sp-2 mb-0 text-[12.5px] text-text-secondary">
                        <span className="font-bold text-text-tertiary">Notes: </span>
                        {item.designNotes}
                      </p>
                    ) : null}
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
                items={crossSellItems}
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

            {/* A "Promo code" field and an Apply button sat here. There is no
                promotion or discount code anywhere in the product — nothing in
                the contracts, the API or the submission payload carries one —
                so Apply only printed "your rep applies it at quote
                confirmation" and threw the code away. The rep never saw it. */}

            <div className="flex justify-between items-center border-t border-border mt-sp-3 pt-sp-4 mb-sp-4">
              <span className="font-display font-bold text-[16px]">Total</span>
              <span className="font-display font-bold text-[22px] text-accent">
                {money(totals.netSubtotal)}
              </span>
            </div>
            <ButtonLink href="/checkout" className="w-full">
              Continue to Checkout
            </ButtonLink>
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <Link
                href="/quote"
                className="block text-center mt-2.5 text-sm font-bold border border-border rounded-md py-2.5 hover:bg-fill-subtle-15 transition-colors"
              >
                Request Quote
              </Link>
            ) : null}
            {/* Read "🔒 Secure checkout · Visa · Mastercard · Amex" directly
                under the checkout button. Checkout takes no card and has no
                processor behind it; it submits the job for design review. */}
            <p className="text-[12px] text-text-tertiary text-center mt-sp-3 mb-1">
              No payment is taken at checkout — we price and invoice after
              design review.
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
