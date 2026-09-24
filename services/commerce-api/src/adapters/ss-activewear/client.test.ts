import { describe, expect, it } from "vitest";
import {
  dollarsToMinor,
  groupSpecsByStyleId,
  normalizeInventoryRow,
  parseSsCategory,
  parseSsSpec,
  parseSsSpecs,
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

describe("parseSsSpec / parseSsSpecs", () => {
  const sample = {
    specID: 39,
    styleID: 253,
    partNumber: "13498",
    brandName: "IZOD",
    styleName: "13Z0075",
    sizeName: "S",
    sizeOrder: "B1",
    specName: "Neck Size",
    value: "16",
  };

  it("parses an official S&S specs object", () => {
    expect(parseSsSpec(sample)).toEqual({
      specID: 39,
      styleID: 253,
      sizeName: "S",
      sizeOrder: "B1",
      specName: "Neck Size",
      value: "16",
    });
  });

  it("accepts string ids and numeric values", () => {
    expect(
      parseSsSpec({
        specID: "12",
        styleID: "39",
        sizeName: " M ",
        specName: " Chest ",
        value: 21.5,
      }),
    ).toEqual({
      specID: 12,
      styleID: 39,
      sizeName: "M",
      specName: "Chest",
      value: "21.5",
    });
  });

  it("drops rows that cannot become a chart cell", () => {
    expect(parseSsSpec(null)).toBeNull();
    expect(parseSsSpec({ styleID: 1, specName: "Chest" })).toBeNull();
    expect(parseSsSpec({ styleID: 1, sizeName: "S" })).toBeNull();
    expect(parseSsSpec({ sizeName: "S", specName: "Chest" })).toBeNull();
  });

  it("unwraps a single object the same way styles/products do", () => {
    expect(parseSsSpecs(sample)).toHaveLength(1);
    expect(parseSsSpecs([sample, { styleID: 1 }])).toHaveLength(1);
    expect(parseSsSpecs(null)).toEqual([]);
  });

  it("groups persistable rows by styleID", () => {
    const grouped = groupSpecsByStyleId(
      parseSsSpecs([
        sample,
        { ...sample, specID: 40, styleID: 253, specName: "Sleeve", value: "33" },
        { ...sample, specID: 41, styleID: 39, specName: "Chest", value: "20" },
      ]),
    );
    expect(grouped.get(253)).toHaveLength(2);
    expect(grouped.get(39)).toEqual([
      {
        specId: 41,
        sizeName: "S",
        sizeOrder: "B1",
        specName: "Chest",
        value: "20",
      },
    ]);
  });
});

describe("dollarsToMinor", () => {
  it("converts customerPrice dollars to cents", () => {
    expect(dollarsToMinor(2.72)).toBe(272);
    expect(dollarsToMinor(undefined)).toBe(0);
  });
});

/**
 * Pavin: "under the unmapped products in categories can we change the
 * numbers to names... no way to know what product 1248 is". S&S's Styles
 * feed sometimes sends a bare numeric category id (e.g. "1248") instead of
 * a name; this is the parser for the separate category *master list*
 * (`/v2/categories/`) that resolves those ids to real names.
 */
describe("parseSsCategory", () => {
  it("pairs a numeric categoryID with its name", () => {
    expect(parseSsCategory({ categoryID: 1248, name: "Youth Apparel" })).toEqual({
      id: "1248",
      name: "Youth Apparel",
    });
  });

  it("prefers name over categoryName when both are present", () => {
    expect(
      parseSsCategory({ categoryID: 5, name: "Headwear", categoryName: "Hats" }),
    ).toEqual({ id: "5", name: "Headwear" });
  });

  it("falls back to categoryName when name is absent", () => {
    expect(
      parseSsCategory({ categoryID: 5, categoryName: "Hats" }),
    ).toEqual({ id: "5", name: "Hats" });
  });

  it("trims whitespace on both id and name", () => {
    expect(
      parseSsCategory({ categoryID: " 1248 ", name: "  Youth Apparel  " }),
    ).toEqual({ id: "1248", name: "Youth Apparel" });
  });

  it("is null without a usable id", () => {
    expect(parseSsCategory({ name: "Youth Apparel" })).toBeNull();
    expect(parseSsCategory({ categoryID: "", name: "Youth Apparel" })).toBeNull();
  });

  it("is null without a usable name", () => {
    expect(parseSsCategory({ categoryID: 1248 })).toBeNull();
    expect(parseSsCategory({ categoryID: 1248, name: "  " })).toBeNull();
  });

  it("accepts a string categoryID, not only numeric", () => {
    expect(parseSsCategory({ categoryID: "youth-apparel", name: "Youth Apparel" })).toEqual({
      id: "youth-apparel",
      name: "Youth Apparel",
    });
  });
});
