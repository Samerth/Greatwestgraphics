import { describe, expect, it } from "vitest";
import {
  mapSizeSpecsToChart,
  parseSizeSpecRow,
} from "../src/application/size-specs.js";

describe("mapSizeSpecsToChart", () => {
  const rows = [
    {
      specId: 1,
      sizeName: "M",
      sizeOrder: "B2",
      specName: "Chest",
      value: "40",
    },
    {
      specId: 2,
      sizeName: "S",
      sizeOrder: "B1",
      specName: "Chest",
      value: "38",
    },
    {
      specId: 3,
      sizeName: "S",
      sizeOrder: "B1",
      specName: "Body Length",
      value: "28",
    },
    {
      specId: 4,
      sizeName: "M",
      sizeOrder: "B2",
      specName: "Body Length",
      value: "29",
    },
  ];

  it("pivots S&S rows into spec names × sizes in sizeOrder", () => {
    expect(mapSizeSpecsToChart(rows)).toEqual({
      sizes: ["S", "M"],
      specNames: ["Chest", "Body Length"],
      cells: {
        Chest: { S: "38", M: "40" },
        "Body Length": { S: "28", M: "29" },
      },
    });
  });

  it("returns null when the vendor sent nothing", () => {
    expect(mapSizeSpecsToChart(null)).toBeNull();
    expect(mapSizeSpecsToChart([])).toBeNull();
    expect(mapSizeSpecsToChart([{ specId: 1 }])).toBeNull();
  });

  it("skips junk jsonb entries", () => {
    expect(parseSizeSpecRow({ sizeName: "S" })).toBeNull();
    expect(
      mapSizeSpecsToChart([
        rows[0],
        { not: "a spec" },
        null,
      ]),
    ).toEqual({
      sizes: ["M"],
      specNames: ["Chest"],
      cells: { Chest: { M: "40" } },
    });
  });
});
