import { describe, expect, it } from "vitest";
import {
  compareRepresentativeColorways,
  parseSearchTerms,
  pickRepresentativeByStyle,
  type StyleGroupableColorway,
} from "../src/application/style-grouping.js";

function colorway(
  overrides: Partial<StyleGroupableColorway> &
    Pick<StyleGroupableColorway, "id" | "styleUuid" | "colorName">,
): StyleGroupableColorway {
  return {
    slug: `${overrides.colorName.toLowerCase()}-slug`,
    qty: 12,
    active: true,
    colorFrontImageUrl: `https://img.example/${overrides.colorName}.jpg`,
    ...overrides,
  };
}

const gildanNavy = colorway({
  id: "p-navy",
  styleUuid: "style-gildan-5000",
  colorName: "Navy",
});
const gildanBlack = colorway({
  id: "p-black",
  styleUuid: "style-gildan-5000",
  colorName: "Black",
  qty: 0,
});
const gildanWhite = colorway({
  id: "p-white",
  styleUuid: "style-gildan-5000",
  colorName: "White",
  colorFrontImageUrl: null,
});
const hoodieGrey = colorway({
  id: "p-hoodie",
  styleUuid: "style-ss4500",
  colorName: "Grey",
});

describe("parseSearchTerms", () => {
  it("splits on whitespace and lowercases", () => {
    expect(parseSearchTerms("  Navy   Hoodie ")).toEqual(["navy", "hoodie"]);
  });

  it("treats a blank search as no terms", () => {
    expect(parseSearchTerms(undefined)).toEqual([]);
    expect(parseSearchTerms("   ")).toEqual([]);
  });
});

describe("compareRepresentativeColorways", () => {
  it("prefers an in-stock colourway over an out-of-stock one", () => {
    expect(compareRepresentativeColorways(gildanNavy, gildanBlack, [])).toBeLessThan(
      0,
    );
  });

  it("prefers a colourway with a photo when stock is equal", () => {
    expect(
      compareRepresentativeColorways(gildanNavy, gildanWhite, []),
    ).toBeLessThan(0);
  });

  it("prefers a colour that matches the shopper's search", () => {
    expect(
      compareRepresentativeColorways(gildanWhite, gildanNavy, ["navy"]),
    ).toBeGreaterThan(0);
  });
});

describe("pickRepresentativeByStyle", () => {
  it("collapses colourways of one styleUuid into a single tile", () => {
    const picked = pickRepresentativeByStyle(
      [gildanNavy, gildanBlack, gildanWhite, hoodieGrey],
      (row) => row,
    );
    expect(picked).toHaveLength(2);
    const gildan = picked.find(
      (entry) => entry.representative.styleUuid === "style-gildan-5000",
    );
    expect(gildan?.colorwayCount).toBe(3);
    expect(gildan?.representative.id).toBe("p-navy");
    expect(
      picked.find((entry) => entry.representative.styleUuid === "style-ss4500")
        ?.representative.id,
    ).toBe("p-hoodie");
  });

  it("does not merge different styles that share a colour name or title", () => {
    const otherNavy = colorway({
      id: "p-other-navy",
      styleUuid: "style-other",
      colorName: "Navy",
    });
    const picked = pickRepresentativeByStyle(
      [gildanNavy, otherNavy],
      (row) => row,
    );
    expect(picked.map((entry) => entry.representative.id).sort()).toEqual([
      "p-navy",
      "p-other-navy",
    ]);
  });

  it("picks the searched colour as the representative image", () => {
    const picked = pickRepresentativeByStyle(
      [gildanNavy, gildanBlack, gildanWhite],
      (row) => row,
      { search: "white" },
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]?.representative.id).toBe("p-white");
  });

  it("returns nothing for an empty page", () => {
    expect(pickRepresentativeByStyle([], (row) => row)).toEqual([]);
  });
});
