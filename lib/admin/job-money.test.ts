import { describe, expect, it } from "vitest";
import { summarizeJobMoney, type JobFinalQuote } from "@/lib/admin/job-money";

const RUN_WIDE_TOTALS = {
  merchandiseMinor: 90000,
  decorationMinor: 30000,
  setupMinor: 3500,
  threadMinor: 0,
  namesNumbersMinor: 0,
  packingMinor: 1290,
  rushMinor: 0,
  subtotalBeforeRushMinor: 124790,
  totalMinor: 137790,
};

const RUN_WIDE_SNAPSHOT = {
  schemaVersion: 2 as const,
  input: { garments: [{ id: "g1" }] },
  breakdown: { totals: RUN_WIDE_TOTALS },
  pricingConfigVersion: 4,
};

/** Three real order lines from one multi-colour Input Quantity session —
 *  same shape GWG-1034 would carry once `checkoutLineTotalMinor` (the
 *  checkout fix) is in place: same shared pricing snapshot on every line,
 *  each line's own `lineTotalMinor` proportional to its own quantity. */
function threeColourLines() {
  return [
    { quantity: 24, lineTotalMinor: 50064, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
    { quantity: 24, lineTotalMinor: 50064, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
    { quantity: 15, lineTotalMinor: 37665, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
  ];
}

describe("summarizeJobMoney", () => {
  it("folds one shared snapshot across every line exactly once, not once per line", () => {
    const result = summarizeJobMoney(threeColourLines(), [], false);
    expect(result.snapshotCount).toBe(1);
    expect(result.breakdownSubtotalMinor).toBe(RUN_WIDE_TOTALS.subtotalBeforeRushMinor);
    // Not 3x — this is the exact failure mode a naive per-line sum produces.
    expect(result.breakdownSubtotalMinor).not.toBe(
      RUN_WIDE_TOTALS.subtotalBeforeRushMinor * 3,
    );
  });

  it("reconciles when the real per-line totals sum back to the run total", () => {
    const result = summarizeJobMoney(threeColourLines(), [], false);
    expect(result.reconciles).toBe(true);
    expect(result.orderTotalMinor).toBe(50064 + 50064 + 37665);
  });

  it("never renders shipping or tax as a number", () => {
    const result = summarizeJobMoney(threeColourLines(), [], false);
    const shipping = result.rows.find((r) => r.key === "shipping");
    const tax = result.rows.find((r) => r.key === "tax");
    expect(shipping?.amountMinor).toBeNull();
    expect(shipping?.note).toBe("Confirmed on the invoice");
    expect(tax?.amountMinor).toBeNull();
    expect(tax?.note).toBe("Confirmed on the invoice");
  });

  it("falls back to total-only when the breakdown genuinely does not add up", () => {
    const lines = [
      // A real mismatch, not rounding drift — off by a dollar.
      { quantity: 24, lineTotalMinor: 60064, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
      { quantity: 24, lineTotalMinor: 50064, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
      { quantity: 15, lineTotalMinor: 37665, configuration: { pricing: RUN_WIDE_SNAPSHOT } },
    ];
    const result = summarizeJobMoney(lines, [], false);
    expect(result.reconciles).toBe(false);
    expect(result.rows.find((r) => r.key === "merchandiseMinor")).toBeUndefined();
    expect(result.rows.find((r) => r.key === "subtotal")).toBeUndefined();
    expect(result.rows.find((r) => r.key === "order-total")?.amountMinor).toBe(
      60064 + 50064 + 37665,
    );
  });

  it("lumps a legacy line with no v2 snapshot into 'other lines'", () => {
    const lines = [
      ...threeColourLines(),
      { quantity: 1, lineTotalMinor: 2000, configuration: {} },
    ];
    const result = summarizeJobMoney(lines, [], false);
    expect(result.unexplainedLineCount).toBe(1);
    expect(result.otherLinesMinor).toBe(2000);
    const other = result.rows.find((r) => r.key === "other");
    expect(other?.amountMinor).toBe(2000);
  });

  it("shows the rush row as 'to be confirmed' on a rush order with no fee priced yet", () => {
    const zeroRushSnapshot = {
      ...RUN_WIDE_SNAPSHOT,
      breakdown: { totals: { ...RUN_WIDE_TOTALS, rushMinor: 0 } },
    };
    const result = summarizeJobMoney(
      [{ quantity: 1, lineTotalMinor: 137790, configuration: { pricing: zeroRushSnapshot } }],
      [],
      true,
    );
    const rush = result.rows.find((r) => r.key === "rush");
    expect(rush).toBeDefined();
    expect(rush?.amountMinor).toBeNull();
    expect(rush?.note).toBe("To Be Confirmed");
  });

  it("omits the rush row entirely on a standard order", () => {
    const result = summarizeJobMoney(threeColourLines(), [], false);
    expect(result.rows.find((r) => r.key === "rush")).toBeUndefined();
  });

  it("carries the highest-version final quote forward", () => {
    const quotes: JobFinalQuote[] = [
      { version: 1, amountMinor: 130000, note: null, acceptedAt: null },
      { version: 2, amountMinor: 137790, note: "revised", acceptedAt: "2026-09-20T00:00:00Z" },
    ];
    const result = summarizeJobMoney(threeColourLines(), quotes, false);
    expect(result.finalQuote?.version).toBe(2);
    expect(result.finalQuote?.amountMinor).toBe(137790);
  });

  it("handles an order with no priced lines at all", () => {
    const result = summarizeJobMoney(
      [{ quantity: 1, configuration: {} }],
      [],
      false,
    );
    expect(result.reconciles).toBe(true);
    expect(result.orderTotalMinor).toBe(0);
    expect(result.snapshotCount).toBe(0);
  });
});
