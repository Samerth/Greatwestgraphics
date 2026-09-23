import { RUSH_FEE_LABEL } from "@/lib/schemas/checkout";
import { getAuthoritativeLineTotalMinor } from "@/lib/utils/quote-pricing";

export interface MoneyRowData {
  key: string;
  label: string;
  amountMinor: number | null;
  note?: string;
}

export interface JobFinalQuote {
  version: number;
  amountMinor: number;
  note: string | null;
  acceptedAt: string | null;
}

export interface JobMoney {
  rows: MoneyRowData[];
  /** Sum of every distinct v2 snapshot's total, counted once each. */
  breakdownSubtotalMinor: number;
  /** Sum of every line that has no usable v2 breakdown — legacy, v1, or a
   *  browser-only estimate never re-priced by the engine. */
  otherLinesMinor: number;
  unexplainedLineCount: number;
  /** The same figure the rest of the page already shows as "Order total" —
   *  unchanged, still the sum of `getAuthoritativeLineTotalMinor`. */
  orderTotalMinor: number;
  /** False when the breakdown rows do not actually add up to the order
   *  total. When false, the UI shows the total and the final quote only —
   *  never a set of numbers that don't sum to what's about to be charged. */
  reconciles: boolean;
  /** How many genuinely distinct pricing runs contributed to the breakdown
   *  — mostly diagnostic, but useful for spotting a job where every size
   *  and colour still carries its own separate snapshot (unexpected). */
  snapshotCount: number;
  finalQuote: JobFinalQuote | null;
}

// Deliberately structural rather than `Pick<JobRequestLineInput, ...>` — the
// real contract type requires the full v2 `QuoteInputV2` shape inside
// `configuration.pricing.input`, but this module never reads inside that
// object beyond using it, opaquely, as half of a dedupe key. Matches the
// looser shape `getAuthoritativeLineTotalMinor` itself already accepts.
interface MoneyLine {
  quantity: number;
  lineTotalMinor?: number;
  unitPriceEstimateMinor?: number;
  configuration?: { pricing?: unknown };
}

function isV2Snapshot(
  pricing: unknown,
): pricing is { schemaVersion: 2; input: unknown; breakdown: { totals: Record<string, number> }; pricingConfigVersion: number } {
  return (
    typeof pricing === "object" &&
    pricing !== null &&
    "schemaVersion" in pricing &&
    (pricing as { schemaVersion?: unknown }).schemaVersion === 2
  );
}

/** A deliberately naive, order-independent key. Two lines that are really
 *  the same pricing run (same design, same run, split only by size or
 *  colour — see the module doc below) carry a byte-identical `input` and
 *  `breakdown.totals`, so they collapse to one key and are folded once. */
function snapshotKey(pricing: {
  input: unknown;
  breakdown: { totals: Record<string, number> };
  pricingConfigVersion: number;
}): string {
  return JSON.stringify([
    pricing.pricingConfigVersion,
    pricing.input,
    pricing.breakdown.totals,
  ]);
}

const BREAKDOWN_ROWS: { key: keyof QuoteTotalsShape; label: string }[] = [
  { key: "merchandiseMinor", label: "Merchandise" },
  { key: "decorationMinor", label: "Decoration" },
  { key: "setupMinor", label: "Screen / digitising setup" },
  { key: "threadMinor", label: "Thread" },
  { key: "namesNumbersMinor", label: "Names & numbers" },
  { key: "packingMinor", label: "Packing" },
];

interface QuoteTotalsShape {
  merchandiseMinor: number;
  decorationMinor: number;
  setupMinor: number;
  threadMinor: number;
  namesNumbersMinor: number;
  packingMinor: number;
  rushMinor: number;
  subtotalBeforeRushMinor: number;
  totalMinor: number;
}

/**
 * Builds the "Final quote" money breakdown (11-point admin note, point 7)
 * out of data that already exists on every line — never a new number.
 *
 * The pricing engine computes one quote for a whole run and that same
 * snapshot is attached to every size and colour line the run produced
 * (`components/design/QuantityStep.tsx` explains why: splitting a run must
 * not re-price each line at its own smaller quantity). Summing
 * `breakdown.totals` across lines would therefore multiply the order by
 * however many lines it has. This function folds each distinct snapshot
 * exactly once instead, keyed on its own input and totals.
 *
 * Shipping and tax are never included as figures: neither is persisted
 * anywhere in this system today (checkout computes GST in the browser and
 * discards it; nothing charges for shipping), and whether PST applies is
 * still an open question with the client's accountant. Both appear as
 * `amountMinor: null` rows for the UI to render as "confirmed on the
 * invoice" — never as an invented number.
 */
export function summarizeJobMoney(
  lines: readonly MoneyLine[],
  finalQuotes: readonly JobFinalQuote[],
  /** Whether the order itself is flagged rush (`fulfillment.turnaround.kind
   *  === "rush"`) — not derivable from the pricing breakdown alone, since a
   *  rush order whose fee hasn't been priced yet has `rushMinor === 0` and
   *  would otherwise look identical to a standard order. */
  isRush: boolean,
): JobMoney {
  const seen = new Map<string, QuoteTotalsShape>();
  let otherLinesMinor = 0;
  let unexplainedLineCount = 0;
  let orderTotalMinor = 0;

  for (const line of lines) {
    const total = getAuthoritativeLineTotalMinor(line) ?? 0;
    orderTotalMinor += total;

    const pricing = line.configuration?.pricing;
    if (isV2Snapshot(pricing)) {
      const key = snapshotKey(pricing);
      if (!seen.has(key)) {
        seen.set(key, pricing.breakdown.totals as unknown as QuoteTotalsShape);
      }
    } else {
      otherLinesMinor += total;
      unexplainedLineCount += 1;
    }
  }

  const folded = [...seen.values()];
  const breakdownSubtotalMinor = folded.reduce((sum, t) => sum + t.subtotalBeforeRushMinor, 0);
  const rushMinor = folded.reduce((sum, t) => sum + t.rushMinor, 0);
  const breakdownTotalMinor = folded.reduce((sum, t) => sum + t.totalMinor, 0);

  // Each raw line's own total is independently rounded to the cent
  // (`checkoutLineTotalMinor`), so a run split across several lines can be a
  // cent or two off its true combined total purely from rounding drift —
  // that is expected, not a sign the breakdown is wrong. Tolerance is one
  // cent per contributing line, which is generous for real drift and still
  // catches a genuinely mismatched breakdown (a real discrepancy is dollars,
  // not cents).
  const roundingTolerance = Math.max(lines.length, 1);
  const reconciles =
    Math.abs(breakdownTotalMinor + otherLinesMinor - orderTotalMinor) <= roundingTolerance;

  const rows: MoneyRowData[] = [];
  if (reconciles && folded.length > 0) {
    for (const { key, label } of BREAKDOWN_ROWS) {
      const amount = folded.reduce((sum, t) => sum + t[key], 0);
      if (amount !== 0) rows.push({ key, label, amountMinor: amount });
    }
    rows.push({
      key: "subtotal",
      label: "Subtotal",
      amountMinor: breakdownSubtotalMinor,
    });
    // Shown even at $0 on a rush order — checkout tells the customer staff
    // will confirm the charge, so the row's presence is the promise, not
    // the number.
    if (isRush || rushMinor > 0) {
      rows.push({
        key: "rush",
        label: "Rush fee",
        amountMinor: rushMinor > 0 ? rushMinor : null,
        note: rushMinor > 0 ? undefined : RUSH_FEE_LABEL,
      });
    }
  }

  rows.push({ key: "shipping", label: "Shipping", amountMinor: null, note: "Confirmed on the invoice" });
  rows.push({ key: "tax", label: "Tax (GST / PST)", amountMinor: null, note: "Confirmed on the invoice" });

  if (unexplainedLineCount > 0) {
    rows.push({
      key: "other",
      label: `Other line${unexplainedLineCount === 1 ? "" : "s"} (${unexplainedLineCount})`,
      amountMinor: otherLinesMinor,
      note: "Not broken down — confirm before quoting",
    });
  }

  rows.push({ key: "order-total", label: "Line items total", amountMinor: orderTotalMinor });

  const latestQuote = [...finalQuotes].sort((a, b) => b.version - a.version)[0] ?? null;

  return {
    rows,
    breakdownSubtotalMinor,
    otherLinesMinor,
    unexplainedLineCount,
    orderTotalMinor,
    reconciles: reconciles || folded.length === 0,
    snapshotCount: folded.length,
    finalQuote: latestQuote,
  };
}
