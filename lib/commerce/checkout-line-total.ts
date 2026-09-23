/**
 * This line's own dollar total, for the order line submitted at checkout.
 *
 * `unit` is the run's blended per-piece price — deliberately shared across
 * every colour and size in the order, because volume breaks are earned
 * across the whole run together, not per colour (see the comment on
 * `PdpStartingPrice`'s sibling logic and `QuantityStep.tsx`'s `quote`).
 * A single cart line's own total is therefore always its own quantity times
 * that shared per-piece price — never a figure read off the shared pricing
 * snapshot, which covers every line in the run combined and is the same
 * object on every one of them.
 *
 * A previous version of this calculation preferred the snapshot's own
 * `breakdown.totals.totalMinor` when present, reasoning it avoided cents of
 * rounding drift versus `qty × unit`. That reasoning holds for a single-line
 * order, where the snapshot's total *is* that one line's total — but the
 * same snapshot is attached, byte-identical, to every line of a multi-colour
 * order added in one visit to Input Quantity, so that "authoritative" total
 * was actually the whole run's combined total, repeated on every line. A
 * customer ordering three colours in one session had all three lines
 * submitted with the same, inflated dollar figure, even though the pieces
 * on each line stayed correct. Multiplying `qty × unit` per line reproduces
 * each line's true share and, summed across a run, still lands within a
 * cent of the snapshot's real combined total.
 */
export function checkoutLineTotalMinor(
  qty: number,
  unit: number,
  priceUnavailable: boolean | undefined,
): number | undefined {
  if (priceUnavailable) return undefined;
  return Math.round(qty * unit * 100);
}
