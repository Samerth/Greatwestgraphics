import { describe, expect, it } from "vitest";
import { catalogCardSubtitle } from "./catalog-card";

describe("catalogCardSubtitle", () => {
  it("shows only the brand when the style has a single colourway", () => {
    expect(catalogCardSubtitle({ brandName: "Gildan", colorwayCount: 1 })).toBe(
      "Gildan",
    );
  });

  it("shows the colourway count instead of a single colour name", () => {
    expect(catalogCardSubtitle({ brandName: "Gildan", colorwayCount: 12 })).toBe(
      "Gildan · 12 colours",
    );
  });

  it("treats a missing count as one colourway", () => {
    expect(catalogCardSubtitle({ brandName: "Adidas" })).toBe("Adidas");
  });
});
