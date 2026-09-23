import { describe, expect, it } from "vitest";
import { checkoutLineTotalMinor } from "@/lib/commerce/checkout-line-total";

describe("checkoutLineTotalMinor", () => {
  it("is undefined when the price could not be computed", () => {
    expect(checkoutLineTotalMinor(24, 20.86, true)).toBeUndefined();
  });

  it("is this line's own quantity times the shared per-piece price", () => {
    expect(checkoutLineTotalMinor(24, 20.86, false)).toBe(50064);
  });

  // The bug this guards against: a customer adding three colours in one
  // visit to Input Quantity gets one combined quote for all of them, and
  // every resulting line used to carry that combined figure instead of its
  // own share. Three lines from the same run must each keep their own total,
  // and those three totals must sum back to (within a cent of) the whole
  // run's real combined total — never triple it.
  it("splits a multi-colour run's total across lines rather than repeating it", () => {
    // A real combined quote: 24 + 24 + 15 = 63 pieces at a blended
    // $21.87/piece, totalMinor = 137790 ($1,377.90).
    const unit = 1377.9 / 63;
    const matchaGreen = checkoutLineTotalMinor(24, unit, false)!;
    const deepBlack = checkoutLineTotalMinor(24, unit, false)!;
    const arcticBlue = checkoutLineTotalMinor(15, unit, false)!;

    expect(matchaGreen).not.toBe(137790);
    expect(deepBlack).not.toBe(137790);
    expect(arcticBlue).not.toBe(137790);

    const combined = matchaGreen + deepBlack + arcticBlue;
    expect(Math.abs(combined - 137790)).toBeLessThanOrEqual(3);
  });

  it("rounds to the nearest cent for a fractional per-piece price", () => {
    // 12 pieces at a price with more than 2 decimal places of precision:
    // 12 * 19.006 = 228.072, which rounds to $228.07.
    expect(checkoutLineTotalMinor(12, 19.006, false)).toBe(22807);
  });
});
