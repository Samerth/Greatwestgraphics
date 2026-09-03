import { create } from "zustand";

export type PdpQuantityBreak = { qty: number; unitMinor: number };

type PdpLiveEstimateState = {
  productId: string | null;
  quantityBreaks: PdpQuantityBreak[];
  /**
   * What the calculator is showing *right now* — the customer's own
   * quantity and the resulting per-piece price.
   *
   * Separate from `quantityBreaks` because the headline used to read
   * `quantityBreaks[0]`, i.e. the smallest break, which is the most
   * expensive price on the page. "Estimated from $160 each at 1 pieces"
   * sitting above a calculator reading $88 at 48 is not a price a customer
   * can act on (CodSphere UAT V2: the top price must update live with the
   * customer's quantity and decoration selections).
   */
  current: PdpQuantityBreak | null;
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
  publish: (
    productId: string,
    quantityBreaks: PdpQuantityBreak[],
    current: PdpQuantityBreak | null,
  ) => void;
};

export const usePdpLiveEstimate = create<PdpLiveEstimateState>((set) => ({
  productId: null,
  quantityBreaks: [],
  current: null,
  publish: (productId, quantityBreaks, current) =>
    set({ productId, quantityBreaks, current }),
}));
