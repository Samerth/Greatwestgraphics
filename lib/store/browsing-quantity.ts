import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BrowsingQuantityState {
  qty: number;
  setQty: (qty: number) => void;
}

/**
 * The quantity a shopper is browsing at — set from the Live Estimate
 * Calculator on any product page, or directly from the catalog listing's
 * own quantity control, and shared by both so "the quantity the customer
 * had last used" actually persists across products (CodSphere UAT V2:
 * catalog pricing should follow the customer's last-used quantity).
 * Persisted so it survives a page reload, not just client-side navigation.
 */
export const useBrowsingQuantity = create<BrowsingQuantityState>()(
  persist(
    (set) => ({
      qty: 48,
      setQty: (qty) => set({ qty: Math.max(1, Math.round(qty)) }),
    }),
    { name: "gwg-browsing-quantity" },
  ),
);
