import { describe, expect, it } from "vitest";
import {
  mapSizeSpecRowsToChart,
  readProductSizeChart,
} from "./size-specs";

const chart = {
  sizes: ["S", "M"],
  specNames: ["Chest"],
  cells: { Chest: { S: "38", M: "40" } },
};

describe("readProductSizeChart", () => {
  it("prefers the catalog-mapped chart on the detail payload", () => {
    expect(
      readProductSizeChart({
        sizeSpecs: chart,
        style: { sizeSpecs: [] },
      }),
    ).toEqual(chart);
  });

  it("pivots raw style.sizeSpecs when the chart field is missing", () => {
    expect(
      readProductSizeChart({
        style: {
          sizeSpecs: [
            {
              specId: 1,
              sizeName: "S",
              sizeOrder: "B1",
              specName: "Chest",
              value: "38",
            },
            {
              specId: 2,
              sizeName: "M",
              sizeOrder: "B2",
              specName: "Chest",
              value: "40",
            },
          ],
        },
      }),
    ).toEqual(chart);
  });

  it("hides the section when SanMar / missing / empty", () => {
    expect(readProductSizeChart(null)).toBeNull();
    expect(readProductSizeChart({ style: { brandName: "SanMar" } })).toBeNull();
    expect(readProductSizeChart({ sizeSpecs: [], style: {} })).toBeNull();
    expect(readProductSizeChart({ sizeSpecs: { sizes: [], specNames: [] } })).toBeNull();
  });
});

describe("mapSizeSpecRowsToChart", () => {
  it("orders sizes from S&S sizeOrder", () => {
    expect(
      mapSizeSpecRowsToChart([
        { sizeName: "XL", sizeOrder: "B4", specName: "Chest", value: "46" },
        { sizeName: "S", sizeOrder: "B1", specName: "Chest", value: "38" },
      ]),
    ).toEqual({
      sizes: ["S", "XL"],
      specNames: ["Chest"],
      cells: { Chest: { S: "38", XL: "46" } },
    });
  });
});
