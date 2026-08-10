import { describe, expect, it } from "vitest";
import {
  dollarsToMinor,
  normalizeInventoryRow,
  sumInventoryQty,
} from "./client.js";

describe("sumInventoryQty / normalizeInventoryRow", () => {
  it("prefers top-level qty when present", () => {
    expect(
      sumInventoryQty({
        qty: 42,
        warehouses: [{ qty: 1 }, { qty: 2 }],
      }),
    ).toBe(42);
  });

  it("sums warehouse qty when top-level qty is missing", () => {
    expect(
      sumInventoryQty({
        warehouses: [
          { warehouseAbbr: "IL", qty: 100 },
          { warehouseAbbr: "NV", qty: 0 },
          { warehouseAbbr: "NJ", qty: 2210 },
          { warehouseAbbr: "KS", qty: 7326 },
        ],
      }),
    ).toBe(9636);
  });

  it("treats missing warehouses as zero", () => {
    expect(sumInventoryQty({})).toBe(0);
  });

  it("normalizes inventory rows to a combined qty", () => {
    expect(
      normalizeInventoryRow({
        skuID_Master: 2343,
        sku: "B00760004",
        warehouses: [{ qty: 10 }, { qty: 5 }],
      }),
    ).toEqual({
      skuID_Master: 2343,
      sku: "B00760004",
      qty: 15,
      warehouses: [{ qty: 10 }, { qty: 5 }],
    });
  });
});

describe("dollarsToMinor", () => {
  it("converts customerPrice dollars to cents", () => {
    expect(dollarsToMinor(2.72)).toBe(272);
    expect(dollarsToMinor(undefined)).toBe(0);
  });
});
