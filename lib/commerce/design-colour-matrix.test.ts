import { describe, expect, it } from "vitest";
import {
  blockQuantity,
  matrixIsEmpty,
  matrixOrderedLines,
  matrixOutOfStockLines,
  matrixTotalQuantity,
  matrixWeightedCost,
  mergeMatrixBlocks,
  type ColourMatrixBlock,
} from "./design-colour-matrix";

function size(
  sizeName: string,
  quantity: number,
  unitCostMinor: number | null = 1000,
  extra: { mapPriceMinor?: number | null; inStock?: boolean } = {},
) {
  return {
    variantId: `${sizeName}-id`,
    sizeName,
    unitCostMinor,
    mapPriceMinor: extra.mapPriceMinor ?? null,
    inStock: extra.inStock ?? true,
    quantity,
  };
}

function block(
  colorName: string,
  sizes: ColourMatrixBlock["sizes"],
): ColourMatrixBlock {
  return {
    productId: `${colorName}-product`,
    colorName,
    imageUrl: null,
    hex: null,
    sizes,
  };
}

const fallback = { unitCostMinor: 900, mapPriceMinor: null };

describe("quantity totals", () => {
  it("sums the sizes within a block", () => {
    expect(blockQuantity(block("Black", [size("S", 3), size("M", 5)]))).toBe(8);
  });

  it("ignores negative quantities rather than subtracting them", () => {
    expect(blockQuantity(block("Black", [size("S", -4), size("M", 5)]))).toBe(5);
  });

  it("sums across every colour", () => {
    const blocks = [
      block("Black", [size("S", 2), size("M", 4)]),
      block("White", [size("L", 6)]),
    ];
    expect(matrixTotalQuantity(blocks)).toBe(12);
  });

  it("treats a matrix with no quantities as empty", () => {
    expect(matrixIsEmpty([block("Black", [size("S", 0), size("M", 0)])])).toBe(true);
    expect(matrixIsEmpty([block("Black", [size("S", 1)])])).toBe(false);
  });
});

describe("ordered lines", () => {
  it("returns only sizes with a quantity entered", () => {
    const blocks = [block("Black", [size("S", 0), size("M", 4), size("L", 1)])];
    expect(matrixOrderedLines(blocks).map((l) => l.size.sizeName)).toEqual([
      "M",
      "L",
    ]);
  });

  it("flags an ordered size that is out of stock, and ignores an unordered one", () => {
    const blocks = [
      block("Black", [
        size("S", 4, 1000, { inStock: false }),
        size("M", 0, 1000, { inStock: false }),
      ]),
    ];
    expect(matrixOutOfStockLines(blocks)).toEqual([
      { colorName: "Black", sizeName: "S" },
    ]);
  });
});

describe("mergeMatrixBlocks", () => {
  it("adds quantities for the same colour and size", () => {
    const named = [block("Black", [size("M", 10)])];
    const spares = [block("Black", [size("M", 3)])];
    const merged = mergeMatrixBlocks(named, spares);
    expect(merged).toHaveLength(1);
    expect(blockQuantity(merged[0]!)).toBe(13);
  });

  it("keeps colours that appear on only one side", () => {
    const named = [block("Black", [size("M", 2)])];
    const spares = [block("White", [size("L", 5)])];
    const merged = mergeMatrixBlocks(named, spares);
    expect(merged.map((b) => b.colorName).sort()).toEqual(["Black", "White"]);
    expect(matrixTotalQuantity(merged)).toBe(7);
  });

  it("does not mutate either input", () => {
    const named = [block("Black", [size("M", 10)])];
    const spares = [block("Black", [size("M", 3)])];
    mergeMatrixBlocks(named, spares);
    expect(blockQuantity(named[0]!)).toBe(10);
    expect(blockQuantity(spares[0]!)).toBe(3);
  });

  it("lets spares push the run into a higher volume break", () => {
    // 10 named + 3 spares must price as one run of 13, not 10 and 3.
    const merged = mergeMatrixBlocks(
      [block("Black", [size("M", 10, 2000)])],
      [block("Black", [size("M", 3, 2000)])],
    );
    const cost = matrixWeightedCost(merged, fallback);
    expect(cost.quantity).toBe(13);
    expect(cost.unitCostMinor).toBe(2000);
  });
});

describe("matrixWeightedCost", () => {
  it("falls back cleanly when nothing has been entered", () => {
    const cost = matrixWeightedCost([block("Black", [size("S", 0)])], fallback);
    expect(cost).toEqual({
      unitCostMinor: 900,
      mapPriceMinor: null,
      quantity: 0,
      matched: false,
    });
  });

  it("weights by quantity within a colour, not by how many sizes exist", () => {
    // 9 Large at 2000 and 1 Small at 1000 must land near 2000, not at 1500.
    const cost = matrixWeightedCost(
      [block("Black", [size("S", 1, 1000), size("L", 9, 2000)])],
      fallback,
    );
    expect(cost.quantity).toBe(10);
    expect(cost.unitCostMinor).toBe(1900);
  });

  it("blends across colours by quantity, honouring each colour's own costs", () => {
    // Heather costs more than white; ordering mostly white should sit near white.
    const cost = matrixWeightedCost(
      [
        block("White", [size("M", 90, 1000)]),
        block("Heather", [size("M", 10, 2000)]),
      ],
      fallback,
    );
    expect(cost.quantity).toBe(100);
    expect(cost.unitCostMinor).toBe(1100);
  });

  it("does not let one colour's cost leak into another", () => {
    // Same sizes, different colours, different costs — each must use its own.
    const cost = matrixWeightedCost(
      [
        block("White", [size("M", 1, 1000)]),
        block("Heather", [size("M", 1, 3000)]),
      ],
      fallback,
    );
    expect(cost.unitCostMinor).toBe(2000);
  });

  it("raises the MAP floor to the highest one in the order", () => {
    const cost = matrixWeightedCost(
      [
        block("White", [size("M", 2, 1000, { mapPriceMinor: 1500 })]),
        block("Heather", [size("M", 2, 2000, { mapPriceMinor: 2500 })]),
      ],
      fallback,
    );
    expect(cost.mapPriceMinor).toBe(2500);
  });

  it("reports matched=false when no line has a real cost", () => {
    const cost = matrixWeightedCost(
      [block("White", [size("M", 5, null)])],
      fallback,
    );
    expect(cost.quantity).toBe(5);
    expect(cost.unitCostMinor).toBe(900);
    expect(cost.matched).toBe(false);
  });

  it("skips colours with no quantity so they cannot drag the average", () => {
    const withEmpty = matrixWeightedCost(
      [
        block("White", [size("M", 10, 1000)]),
        block("Heather", [size("M", 0, 9000)]),
      ],
      fallback,
    );
    expect(withEmpty.unitCostMinor).toBe(1000);
    expect(withEmpty.quantity).toBe(10);
  });
});
