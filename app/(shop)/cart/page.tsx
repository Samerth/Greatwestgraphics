"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Shirt } from "lucide-react";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CrossSellGrid, type CrossSellItem } from "@/components/shared/CrossSellGrid";
import { trackCartItemAdded } from "@/lib/analytics/gtag";
import { useCartStore, useVisibleCartItems, computeCartTotals, cartItemEditHref, cartLineIsCustomized, PRICE_TO_BE_CONFIRMED_LABEL, type CartItem } from "@/lib/store/cart";
import { money, moneyFromMinor } from "@/lib/utils/quote-pricing";
import { RosterTable } from "@/components/shared/RosterTable";
import { DesignLineThumbnail } from "@/components/design/DesignLineThumbnail";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";
import { cartGroupSizeBreakdown, groupCartItemsByProduct } from "@/lib/commerce/cart-groups";

/**
 * True for our own private, cookie-gated upload route (customer artwork,
 * design proofs). Next's image optimizer fetches a same-app image via an
 * internal mocked request that carries no headers at all — not even
 * cookies (see node_modules/next/dist/server/image-optimizer.js,
 * fetchInternalImage → createRequestResponseMocks) — so /api/uploads/...
 * always looks unauthenticated to it, the route correctly 404s, and the
 * optimizer reports back "not a valid image" (400) even though the file is
 * really there. These URLs must render unoptimized so the *browser* fetches
 * them directly, carrying the customer's real cookies the normal way.
 */
function isPrivateUploadUrl(src: string): boolean {
  return src.startsWith("/api/uploads/");
}

const SAVED_KEY = "gwg-cart-saved";

export default function CartPage() {
  const items = useVisibleCartItems();
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const addItem = useCartStore((s) => s.addItem);
  const totals = computeCartTotals(items);
  const unpricedCount = items.filter((i) => i.priceUnavailable).length;

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
            {/*
              One card per product — Product > Decoration > Colour > Sizes,
              the tree Pavin asked for once he saw the two options. Before
              this, a design ordered in three colours across four sizes was
              four near-identical cards, each showing the same picture
              (Pavin: "cart shows different lines for the same product with
              different size variants, make it clean like the input quantity
              page" — and "1 image with variables on left"). Grouping is
              presentation only (`groupCartItemsByProduct`,
              `lib/commerce/cart-groups.ts`): every original line is still
              its own `CartItem` underneath, so Remove, the quantity stepper
              and Save for later below still act on one specific size's own
              identity, exactly as before.
            */}
            {groupCartItemsByProduct(items).map((product) => (
              <div
                key={product.key}
                className="border border-border rounded-md bg-bg-raised overflow-hidden"
              >
                <div className="flex items-start justify-between gap-sp-3 px-sp-4 py-sp-3 border-b border-border bg-bg">
                  <div className="min-w-0">
                    <h4 className="font-bold text-[15.5px] truncate m-0">
                      {product.name}
                    </h4>
                    <p className="text-[12.5px] text-text-tertiary m-0 mt-0.5">
                      {product.quantity.toLocaleString()} pieces
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-text-tertiary font-bold mb-0.5">
                      Product total
                    </div>
                    <div
                      className={
                        product.hasUnpriced
                          ? "font-display font-bold text-[15px] text-text-tertiary"
                          : "font-display font-bold text-[17px]"
                      }
                    >
                      {product.hasUnpriced
                        ? PRICE_TO_BE_CONFIRMED_LABEL
                        : moneyFromMinor(product.totalMinor)}
                    </div>
                  </div>
                </div>

                {product.decorations.map((decoration) => (
                  <div
                    key={decoration.key}
                    className="px-sp-4 py-sp-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3 mb-sp-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
                        {decoration.label}
                      </span>
                      <Link
                        href={cartItemEditHref(decoration.representative)}
                        className="text-[12.5px] font-semibold text-text-tertiary hover:text-accent transition-colors"
                      >
                        Edit
                      </Link>
                    </div>

                    <div className="space-y-sp-3">
                      {decoration.colours.map((colourGroup) => {
                        const rep = colourGroup.representative;
                        const sizeBreakdown = cartGroupSizeBreakdown(
                          colourGroup.items,
                        );
                        return (
                          <div
                            key={colourGroup.key}
                            className="flex flex-col sm:flex-row gap-sp-3 rounded-md border border-border p-sp-3"
                          >
                            <DesignLineThumbnail
                              design={rep.designSnapshot}
                              garmentPhotos={rep.garmentPhotos}
                              className="relative w-full sm:w-16 h-16 shrink-0 rounded-md overflow-hidden bg-fill-subtle"
                              fallback={
                                rep.image ? (
                                  <Image
                                    src={rep.image}
                                    alt={`${product.name} — ${rep.color}`}
                                    fill
                                    unoptimized={isPrivateUploadUrl(rep.image)}
                                    className="object-cover object-top"
                                  />
                                ) : (
                                  // Neither this colourway's own photo nor
                                  // the style's general one was available —
                                  // an empty grey box reads as broken, so
                                  // this always shows something instead.
                                  <div className="absolute inset-0 grid place-items-center text-text-tertiary/50">
                                    <Shirt aria-hidden size={22} strokeWidth={1.5} />
                                  </div>
                                )
                              }
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-bold text-[14px]">
                                  {rep.color}
                                </span>
                                <span
                                  className={
                                    colourGroup.hasUnpriced
                                      ? "font-bold text-[13px] text-text-tertiary shrink-0"
                                      : "font-bold text-[14px] shrink-0"
                                  }
                                >
                                  {colourGroup.hasUnpriced
                                    ? PRICE_TO_BE_CONFIRMED_LABEL
                                    : moneyFromMinor(colourGroup.totalMinor)}
                                </span>
                              </div>
                              {sizeBreakdown && (
                                <p className="text-[13px] font-semibold text-text-secondary tabular-nums m-0 mt-0.5">
                                  {sizeBreakdown}
                                </p>
                              )}

                              {/* Always visible, not tucked behind a click:
                                  this is who each shirt in the order
                                  actually goes to. A roster group always
                                  holds exactly one item — see
                                  `groupCartItems`. */}
                              {rep.roster && (
                                <div className="mt-sp-2">
                                  <span className="block text-[12px] font-bold text-text-secondary mb-1">
                                    Names &amp; numbers ({rep.roster.length})
                                  </span>
                                  <RosterTable roster={rep.roster} />
                                </div>
                              )}
                              {rep.designNotes ? (
                                <p className="mt-sp-1.5 mb-0 text-[12px] text-text-secondary">
                                  <span className="font-bold text-text-tertiary">
                                    Notes:{" "}
                                  </span>
                                  {rep.designNotes}
                                </p>
                              ) : null}

                              {/* One row per size — the underlying
                                  `CartItem` each belongs to, so its own
                                  quantity, Remove and Save for later still
                                  address that exact line. */}
                              <div className="mt-sp-2 space-y-1.5">
                                {colourGroup.items.map((item) => (
                                  <div
                                    key={`${item.id}-${item.color}-${item.variantId ?? ""}`}
                                    className="flex items-center gap-3 flex-wrap text-[12.5px]"
                                  >
                                    <span className="font-bold text-text-secondary w-10 shrink-0">
                                      {item.size ?? "—"}
                                    </span>

                                    {cartLineIsCustomized(item) ? (
                                      // Decorated lines (roster or
                                      // single-item design) are priced for
                                      // one specific quantity at
                                      // add-to-cart time. Letting qty
                                      // change here would keep charging
                                      // that frozen unit price at a
                                      // different volume tier — send them
                                      // back to Edit to re-quote instead.
                                      <span className="text-text-tertiary">
                                        {item.qty.toLocaleString()}{" "}
                                        {item.qty === 1 ? "piece" : "pieces"}{" "}
                                        · quantity locked
                                      </span>
                                    ) : (
                                      <div className="flex items-center border border-border rounded-full overflow-hidden w-fit">
                                        <button
                                          aria-label={`Decrease quantity for size ${item.size ?? ""}`}
                                          className="w-6 h-6 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
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
                                        <span className="w-8 text-center font-bold">
                                          {item.qty}
                                        </span>
                                        <button
                                          aria-label={`Increase quantity for size ${item.size ?? ""}`}
                                          className="w-6 h-6 grid place-items-center font-bold text-text-secondary hover:bg-fill-subtle-15 transition-colors"
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

                                    <div className="flex gap-3 ml-auto font-semibold">
                                      <button
                                        type="button"
                                        className="text-text-tertiary hover:text-accent transition-colors"
                                        onClick={() =>
                                          removeItem(
                                            item.id,
                                            item.color,
                                            item.variantId,
                                          )
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
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
              {/* A "Shipping (Vancouver) · Free" row sat here. It stated a
                  shipping charge on a page that is not checkout, which the
                  client decided against on 11 September ("shipping charges
                  appear at checkout only, not on other pages"), and it was
                  wrong twice over: it promised free shipping unconditionally
                  when the threshold is $300, and named Vancouver when pickup
                  is a separate choice made at checkout. Where shipping lands
                  is said below instead, without quoting a price for it. */}
            </div>

            {/* A "Promo code" field and an Apply button sat here. There is no
                promotion or discount code anywhere in the product — nothing in
                the contracts, the API or the submission payload carries one —
                so Apply only printed "your rep applies it at quote
                confirmation" and threw the code away. The rep never saw it. */}

            {/* "Total" on a figure that is netSubtotal — no tax, no shipping
                — read as the final charge and then grew at checkout with no
                explanation beyond the small print below (client-meeting
                note, 21 Sep: "per unit cost should include all other
                prices" applies here too). "Estimated subtotal" pairs with
                checkout's own "Estimated Total" (which is this same figure
                plus GST and shipping) instead of repeating the "Subtotal (N
                pieces)" row above verbatim. */}
            <div className="flex justify-between items-center border-t border-border mt-sp-3 pt-sp-4 mb-sp-4">
              <span className="font-display font-bold text-[16px]">
                Estimated subtotal
              </span>
              <span className="font-display font-bold text-[22px] text-accent">
                {money(totals.netSubtotal)}
              </span>
            </div>
            {unpricedCount > 0 && (
              <p className="text-[12px] text-text-tertiary text-center mb-sp-3 -mt-sp-2">
                This does not include the {unpricedCount === 1 ? "item" : `${unpricedCount} items`}{" "}
                marked {PRICE_TO_BE_CONFIRMED_LABEL.toLowerCase()} above — our
                team will price {unpricedCount === 1 ? "it" : "them"} and
                confirm before you pay.
              </p>
            )}
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
            <p
              data-cart="shipping-note"
              className="text-[12px] text-text-tertiary text-center mt-sp-3 mb-1"
            >
              Shipping and tax are calculated at checkout.
            </p>
            <p className="text-[12px] text-text-tertiary text-center mb-1">
              No payment is taken at checkout — we price and invoice after
              design review.
            </p>
            <p className="text-[12px] text-text-tertiary text-center m-0">
              Per-piece pricing improves as your quantity goes up.
            </p>
          </div>
        </div>

        <div className="mt-sp-7 flex flex-wrap justify-center gap-x-sp-5 gap-y-2 text-sm text-text-secondary border border-border rounded-md py-3 px-4 bg-bg-raised">
          <span>✓ Pay after proof</span>
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
