import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  meta: string;
  color: string;
  qty: number;
  unit: number;
  image: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string, color: string) => void;
  updateQty: (id: string, color: string, qty: number) => void;
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
          const existing = state.items.find(
            (c) => c.id === item.id && c.color === item.color
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
      removeItem: (id, color) =>
        set((state) => ({
          items: state.items.filter((c) => !(c.id === id && c.color === color)),
        })),
      updateQty: (id, color, qty) =>
        set((state) => ({
          items: state.items.map((c) =>
            c.id === id && c.color === color ? { ...c, qty: Math.max(1, qty) } : c
          ),
        })),
      clear: () => set({ items: [] }),
      pieceCount: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),
    { name: "gwg-cart" }
  )
);
