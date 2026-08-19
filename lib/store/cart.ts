"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LinePricingSnapshot,
  LinePricingSnapshotV2,
} from "@gwg/contracts";

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
      addItem: (item) =>
        set((state) => {
          const stamped: CartItem = {
            ...item,
            storeSlug: item.storeSlug ?? (state.activeStore.slug || undefined),
          };
          // Roster (team/group order) lines always add as their own line —
          // merging two separate roster submissions into one qty would lose
          // which names/numbers came from which submission.
          const existing = stamped.roster
            ? undefined
            : state.items.find(
                (c) =>
                  c.id === stamped.id &&
                  c.color === stamped.color &&
                  c.variantId === stamped.variantId &&
                  !c.roster &&
                  cartItemBelongsToStore(c, state.activeStore),
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
