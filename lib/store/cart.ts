import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LinePricingSnapshot } from "@gwg/contracts";

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
  /** Transparent artwork-only PNG from the Design Studio, when the item includes custom art. */
  artworkProofUrl?: string;
  /** Team/group order: one row per piece with its own size, name and number. When present, `qty` equals `roster.length`. */
  roster?: { size: string; name: string; number?: string }[];
  /** Full quote breakdown, present when added from the Quote Builder. */
  pricingSnapshot?: LinePricingSnapshot;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string, color: string, variantId?: string) => void;
  updateQty: (id: string, color: string, qty: number, variantId?: string) => void;
  clear: () => void;
  pieceCount: () => number;
}

// Pricing math ported 1:1 from computeCartTotals() in the original script.js.
export function computeCartTotals(items: CartItem[], deliveryFee = 0) {
  const pieces = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit, 0);
  let discountRate = 0;
  if (pieces >= 75) discountRate = 0.12;
  else if (pieces >= 50) discountRate = 0.08;
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
      addItem: (item) =>
        set((state) => {
          // Roster (team/group order) lines always add as their own line —
          // merging two separate roster submissions into one qty would lose
          // which names/numbers came from which submission.
          const existing = item.roster
            ? undefined
            : state.items.find(
                (c) =>
                  c.id === item.id &&
                  c.color === item.color &&
                  c.variantId === item.variantId &&
                  !c.roster
              );
          if (existing) {
            return {
              items: state.items.map((c) =>
                c === existing ? { ...c, qty: c.qty + item.qty } : c
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      removeItem: (id, color, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (c) =>
              !(c.id === id && c.color === color && c.variantId === variantId)
          ),
        })),
      updateQty: (id, color, qty, variantId) =>
        set((state) => ({
          items: state.items.map((c) =>
            c.id === id && c.color === color && c.variantId === variantId
              ? { ...c, qty: Math.max(1, qty) }
              : c
          ),
        })),
      clear: () => set({ items: [] }),
      pieceCount: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),
    { name: "gwg-cart" }
  )
);
