"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DesignDocument,
  LinePricingSnapshot,
  LinePricingSnapshotV2,
  RosterDecor,
} from "@gwg/contracts";
import type { GarmentPhotoSet } from "@/lib/commerce/garment-backdrop";

export interface CartItem {
  id: string;
  name: string;
  meta: string;
  color: string;
  /** Selected size label when known (e.g. from catalog PDP). Size may also appear in `meta` or `roster`. */
  size?: string;
  qty: number;
  unit: number;
  image: string;
  /** Canonical `ss_products` UUID, present when added from the live catalog. */
  productId?: string;
  /** Catalog slug for `/product/<slug>?id=` links. Never use `id` as the slug. */
  productSlug?: string;
  /** Canonical `ss_styles` UUID, present when added from the live catalog. */
  styleId?: string;
  /** Canonical `ss_variants` UUID (specific size), present when added from the live catalog. */
  variantId?: string;
  /**
   * Rendered proof of the decorated garment, as a stored URL the API and the
   * admin can both load. It is deliberately not a `data:` URL — the cart lives
   * in localStorage, which a base64 PNG per line overflows, and the job payload
   * would carry the whole image inline.
   */
  artworkProofUrl?: string;
  /**
   * The design's own layout — where every logo and text box sits, and which
   * files to draw — frozen at the moment this line was added. Positions and
   * file links, not pixels, so this is typically only a few KB even though
   * `artworkProofUrl` above is a single flattened picture of just one
   * colour. Paired with `garmentPhotos` below, this lets the cart, admin and
   * portal each redraw the same design on THIS line's own colour instead of
   * showing every colour the same picture (Pavin, client meeting: "try to
   * show same design on different colour"). Omitted when the design still
   * has artwork that has not finished uploading — see
   * `ephemeralArtworkSides` — since a file link that would not survive a
   * reload is exactly the bug `isDurableArtworkSrc` exists to catch.
   */
  designSnapshot?: DesignDocument;
  /** This line's own colourway photos, read alongside `designSnapshot`. */
  garmentPhotos?: GarmentPhotoSet;
  /** The saved design this line was built from, so staff can open and edit it. */
  designProjectId?: string;
  /** Team/group order: one row per piece with its own size, name and number. When present, `qty` equals `roster.length`. */
  roster?: { size: string; name: string; number?: string }[];
  /** Studio special instructions. Additive — older cart lines omit this. */
  designNotes?: string;
  /** Independent names vs numbers print settings from the studio. */
  rosterDecor?: RosterDecor;
  /**
   * Full quote breakdown, present when added from the Quote Builder. Carts
   * persisted before the v2 migration still hold a v1 snapshot, so both
   * shapes have to be readable.
   */
  pricingSnapshot?: LinePricingSnapshotV2 | LinePricingSnapshot;
  /**
   * Which storefront this line was added on. The same browser can shop the
   * main site and a company store; without this, checkout submits one cart
   * against whichever cookie is current.
   */
  storeSlug?: string;
  /**
   * The Input Quantity step could not price this configuration automatically
   * (a combination the engine refused, or a cost missing from the catalog),
   * but let the customer submit it rather than dead-ending them — the site
   * never fakes a price, so `unit` is 0 here and every screen that shows
   * money for a line must check this flag first and say "Price to be
   * confirmed" instead. The API already reads a line with no pricing
   * snapshot as unverified and flags it for staff
   * (job-request-service.ts `repriceLine`) — this is that case, reached
   * deliberately instead of by accident.
   */
  priceUnavailable?: boolean;
}

/** What a `priceUnavailable` line shows in place of a dollar figure, on the
 *  cart page and in the checkout summary — never a blank, never "$0.00". */
export const PRICE_TO_BE_CONFIRMED_LABEL = "Price to be confirmed";

export type ActiveCartStore = { slug: string; isPublic: boolean };

export function cartItemBelongsToStore(
  item: Pick<CartItem, "storeSlug">,
  store: ActiveCartStore,
): boolean {
  if (item.storeSlug) return item.storeSlug === store.slug;
  // Untagged lines predate per-store carts and belong to the retail shop.
  return store.isPublic;
}

export function visibleCartItems(
  items: CartItem[],
  store: ActiveCartStore,
): CartItem[] {
  return items.filter((item) => cartItemBelongsToStore(item, store));
}

/** A decorated line must never fold into a blank garment of the same SKU. */
export function cartLineIsCustomized(
  item: Pick<CartItem, "artworkProofUrl" | "designProjectId" | "roster">,
): boolean {
  return Boolean(item.artworkProofUrl || item.designProjectId || item.roster);
}

export function blankGarmentMergeTarget(
  items: CartItem[],
  incoming: CartItem,
  store: ActiveCartStore,
): CartItem | undefined {
  if (cartLineIsCustomized(incoming)) return undefined;
  return items.find(
    (candidate) =>
      !cartLineIsCustomized(candidate) &&
      candidate.id === incoming.id &&
      candidate.color === incoming.color &&
      candidate.variantId === incoming.variantId &&
      cartItemBelongsToStore(candidate, store),
  );
}

/** Cart "Edit" must reopen the studio for decorated lines — never a UUID as a PDP slug. */
export function cartItemEditHref(
  item: Pick<
    CartItem,
    | "id"
    | "productId"
    | "productSlug"
    | "designProjectId"
    | "artworkProofUrl"
    | "roster"
  >,
): string {
  const garmentId = item.productId || item.id;
  if (item.designProjectId) {
    const params = new URLSearchParams({ loadDesignId: item.designProjectId });
    if (garmentId) params.set("garmentId", garmentId);
    return `/design?${params.toString()}`;
  }
  if (item.artworkProofUrl || item.roster) {
    const params = new URLSearchParams();
    if (garmentId) params.set("garmentId", garmentId);
    return `/design?${params.toString()}`;
  }
  if (item.productId) {
    const slug = item.productSlug || item.productId;
    return `/product/${encodeURIComponent(slug)}?id=${encodeURIComponent(item.productId)}`;
  }
  return "/products";
}

interface CartState {
  items: CartItem[];
  activeStore: ActiveCartStore;
  setActiveStore: (store: ActiveCartStore) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string, color: string, variantId?: string) => void;
  updateQty: (id: string, color: string, qty: number, variantId?: string) => void;
  clear: () => void;
  pieceCount: () => number;
}

/**
 * Line prices already come from the pricing engine, which builds the volume
 * break into the per-piece price. The cart therefore adds no discount of its
 * own — the flat 8%/12% tiers it used to apply would discount an
 * already-discounted price and quietly undercut every large order.
 */
export function computeCartTotals(items: CartItem[], deliveryFee = 0) {
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit, 0);
  const discountRate = 0;
  const discount = subtotal * discountRate;
  const netSubtotal = subtotal - discount;
  const gst = netSubtotal * 0.05;
  const total = netSubtotal + gst + deliveryFee;
  const deposit = total * 0.5;
  // A priceUnavailable line contributes 0 above, on purpose (never a faked
  // price) — which means every total here is real but incomplete while one
  // is in the cart. Screens that show these totals must say so rather than
  // let a customer read the number as final.
  const hasUnpricedItems = items.some((i) => i.priceUnavailable);
  return {
    pieces,
    subtotal,
    discountRate,
    discount,
    netSubtotal,
    gst,
    deliveryFee,
    total,
    deposit,
    hasUnpricedItems,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      activeStore: { slug: "", isPublic: true },
      setActiveStore: (activeStore) => set({ activeStore }),
      addItem: (item) =>
        set((state) => {
          const stamped: CartItem = {
            ...item,
            storeSlug: item.storeSlug ?? (state.activeStore.slug || undefined),
          };
          // Blank catalog lines of the same SKU can stack. A studio design
          // (proof, saved project, or roster) is its own line — merging it
          // into a blank tee dropped the artwork and left "Edit" pointing at
          // a catalog PDP instead of the customized item.
          const existing = blankGarmentMergeTarget(
            state.items,
            stamped,
            state.activeStore,
          );
          if (existing) {
            return {
              items: state.items.map((c) =>
                c === existing ? { ...c, qty: c.qty + stamped.qty } : c
              ),
            };
          }
          return { items: [...state.items, stamped] };
        }),
      removeItem: (id, color, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (c) =>
              !(
                c.id === id &&
                c.color === color &&
                c.variantId === variantId &&
                cartItemBelongsToStore(c, state.activeStore)
              )
          ),
        })),
      updateQty: (id, color, qty, variantId) =>
        set((state) => ({
          items: state.items.map((c) =>
            c.id === id &&
            c.color === color &&
            c.variantId === variantId &&
            cartItemBelongsToStore(c, state.activeStore)
              ? { ...c, qty: Math.max(1, qty) }
              : c
          ),
        })),
      // Only the current storefront's lines — a retail checkout must not
      // wipe a company cart sitting in the same browser.
      clear: () =>
        set((state) => ({
          items: state.items.filter(
            (c) => !cartItemBelongsToStore(c, state.activeStore),
          ),
        })),
      pieceCount: () =>
        visibleCartItems(get().items, get().activeStore).reduce(
          (s, i) => s + i.qty,
          0,
        ),
    }),
    {
      name: "gwg-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export function useVisibleCartItems(): CartItem[] {
  const items = useCartStore((s) => s.items);
  const activeStore = useCartStore((s) => s.activeStore);
  return useMemo(
    () => visibleCartItems(items, activeStore),
    [items, activeStore],
  );
}
