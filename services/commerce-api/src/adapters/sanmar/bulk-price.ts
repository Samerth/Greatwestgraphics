import type { SanmarBulkProduct } from "./client.js";

/**
 * What a Bulk refresh may do to one part's price.
 *
 * In the 1 Oct 2026 reply, 3,702 parts carried a `salePrice`, and for 3,064 of
 * them the ordinary `price` field already equalled it: while a sale runs,
 * Bulk's `price` IS the sale price, and the regular one is not sent at all.
 * Written straight through, the daily refresh would lower garment cost on about
 * 3,000 parts for as long as SanMar's sales run and put it back afterwards. Whether
 * GWG's garment costs should follow SanMar's sales is a decision for Pavin, not
 * one for the sync to make by accident, so until it is made a part on sale keeps
 * the price already on file. The only exception is a part with no price at all
 * (0.00 on file, 1,514 parts in staging): any real price beats none, so a
 * missing price is filled in and an existing one is left alone.
 *
 * Set `SANMAR_BULK_FOLLOW_SALE_PRICES=true` to follow the sales.
 */
export type BulkPriceInstruction =
  | { kind: "none" }
  | { kind: "write"; priceDollars: number }
  | { kind: "fillIfMissing"; priceDollars: number };

export function bulkPriceInstruction(
  row: Pick<SanmarBulkProduct, "price" | "salePrice">,
  followSalePrices: boolean,
): BulkPriceInstruction {
  const price = row.price;
  // 0.00, negative or absent means SanMar has no price for the part.
  if (price == null || !(price > 0)) return { kind: "none" };
  const sale = row.salePrice;
  const priceIsTheSalePrice =
    sale != null && sale > 0 && Math.abs(price - sale) < 0.005;
  if (priceIsTheSalePrice && !followSalePrices) {
    return { kind: "fillIfMissing", priceDollars: price };
  }
  return { kind: "write", priceDollars: price };
}
