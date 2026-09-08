import { describe, expect, it } from "vitest";
import { lineSnapshotTotalMinor, getAuthoritativeLineTotalMinor } from "./quote-pricing";

describe("lineSnapshotTotalMinor", () => {
  it("reads a v1 breakdown total", () => {
    expect(lineSnapshotTotalMinor({ breakdown: { totalMinor: 2500 } })).toBe(
      2500,
    );
  });

  it("prefers a v2 totals nest", () => {
    expect(
      lineSnapshotTotalMinor({
        breakdown: { totalMinor: 1, totals: { totalMinor: 9900 } },
      }),
    ).toBe(9900);
  });

  it("returns undefined when nothing is stored", () => {
    expect(lineSnapshotTotalMinor(undefined)).toBeUndefined();
    expect(lineSnapshotTotalMinor({})).toBeUndefined();
  });
});

describe("getAuthoritativeLineTotalMinor", () => {
  it("prefers lineTotalMinor when present", () => {
    const line = {
      lineTotalMinor: 22808,
      unitPriceEstimateMinor: 1901,
      quantity: 12,
      configuration: { pricing: { breakdown: { totalMinor: 99999 } } },
    };
    expect(getAuthoritativeLineTotalMinor(line)).toBe(22808);
  });

  it("falls back to pricing snapshot total when lineTotalMinor is absent", () => {
    const line = {
      unitPriceEstimateMinor: 1901,
      quantity: 12,
      configuration: { pricing: { breakdown: { totalMinor: 22808 } } },
    };
    expect(getAuthoritativeLineTotalMinor(line)).toBe(22808);
  });

  it("falls back to unit×qty when no authoritative total exists", () => {
    const line = {
      unitPriceEstimateMinor: 1901,
      quantity: 12,
      configuration: {},
    };
    expect(getAuthoritativeLineTotalMinor(line)).toBe(22812);
  });

  it("returns undefined when no pricing data exists", () => {
    const line = { quantity: 12, configuration: {} };
    expect(getAuthoritativeLineTotalMinor(line)).toBeUndefined();
  });

  describe("round-then-multiply drift prevention", () => {
    it("detects when unit×qty would drift from true total", () => {
      // GWG-1024 repro: $228.08 / 12 = $19.006666...
      // Rounded to cents: 1901
      // 1901 * 12 = 22812 (not 22808!)
      const trueTotalMinor = 22808;
      const roundedUnitMinor = 1901;
      const qty = 12;
      const driftedTotal = roundedUnitMinor * qty; // 22812
      
      expect(driftedTotal).not.toBe(trueTotalMinor);
      expect(driftedTotal - trueTotalMinor).toBe(4); // $0.04 drift
    });

    it("uses authoritative total to avoid drift", () => {
      const trueTotalMinor = 22808;
      const line = {
        lineTotalMinor: trueTotalMinor,
        unitPriceEstimateMinor: 1901,
        quantity: 12,
        configuration: {},
      };
      expect(getAuthoritativeLineTotalMinor(line)).toBe(trueTotalMinor);
    });

    it("uses pricing snapshot total when lineTotalMinor is missing", () => {
      const trueTotalMinor = 22808;
      const line = {
        unitPriceEstimateMinor: 1901,
        quantity: 12,
        configuration: {
          pricing: { breakdown: { totals: { totalMinor: trueTotalMinor } } },
        },
      };
      expect(getAuthoritativeLineTotalMinor(line)).toBe(trueTotalMinor);
    });
  });
});
