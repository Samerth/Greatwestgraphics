import { create } from "zustand";

export type PdpQuantityBreak = { qty: number; unitMinor: number };

type PdpLiveEstimateState = {
  productId: string | null;
  quantityBreaks: PdpQuantityBreak[];
  /**
   * The Live Estimate Calculator (PdpDetailedQuote) publishes its current
   * quantity-break pricing here on every recompute, so any other widget on
   * the same product page — today, just the "Estimated from" headline near
   * the title (PdpStartingPrice) — reflects the customer's actual live
   * decoration/quantity selection instead of a second, independently
   * guessed default (CodSphere UAT V2: "price from" should update
   * dynamically based on the customer's current quote selections).
   *
   * Scoped by productId so switching products can't show a stale price
   * left over from the last one.
   */
  publish: (productId: string, quantityBreaks: PdpQuantityBreak[]) => void;
};

export const usePdpLiveEstimate = create<PdpLiveEstimateState>((set) => ({
  productId: null,
  quantityBreaks: [],
  publish: (productId, quantityBreaks) => set({ productId, quantityBreaks }),
}));
