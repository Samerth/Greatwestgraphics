"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LinePricingSnapshot,
  LinePricingSnapshotV2,
} from "@gwg/contracts";
import { trackAddToCart } from "@/lib/analytics/gtag";

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
  /** The saved design this line was built from, so staff can open and edit it. */
  designProjectId?: string;
  /** Team/group order: one row per piece with its own size, name and number. When present, `qty` equals `roster.length`. */
  roster?: { size: string; name: string; number?: string }[];
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
}

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
  return { pieces, subtotal, discountRate, discount, netSubtotal, gst, deliveryFee, total, deposit };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      activeStore: { slug: "", isPublic: true },
      setActiveStore: (activeStore) => set({ activeStore }),
      addItem: (item) => {
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
        });
        trackAddToCart({
          item_id: item.productId ?? item.id,
          item_name: item.name,
          quantity: item.qty,
          value: Number((item.qty * item.unit).toFixed(2)),
          currency: "CAD",
        });
      },
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
