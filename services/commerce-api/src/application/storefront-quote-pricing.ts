import type { QuoteBreakdownV2 } from "@gwg/contracts";
import { roundMinor } from "@gwg/pricing";

/**
 * The per-piece figure `POST /pricing/quote` reports back — to CodChat, and
 * through it to a customer reading "**$X per unit** for a total of **$Y**".
 *
 * The pricing engine's own `garments[].unitPriceMinor` is garment cost plus
 * decoration cost, deliberately leaving setup off (it is a staff-facing
 * breakdown, and setup is charged once per order, not per piece). Reported as
 * the storefront's "unit price" that gap became the "per unit vs total
 * slightly off" defect from the client's meeting: a 100-piece, 1-colour job
 * read $47.62/unit next to a $4,797.00 total - the $35 screen-print setup
 * accounted for in the total but not in the unit price a customer multiplies
 * by hand.
 *
 * `total / qty` always reconciles, because it is the same division a
 * customer or CodChat would themselves perform - this mirrors
 * `customerUnitMinor` in the web app's `lib/commerce/storefront-quote.ts`,
 * which exists for the identical reason on the storefront's own quote
 * surfaces (product page, quantity step, cart).
 */
export function storefrontUnitPriceMinor(
  breakdown: Pick<QuoteBreakdownV2, "totals">,
  qty: number,
): number {
  if (qty <= 0) return 0;
  return roundMinor(breakdown.totals.totalMinor / qty);
}
