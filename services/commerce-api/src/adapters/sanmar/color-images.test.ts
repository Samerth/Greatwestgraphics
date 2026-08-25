import { describe, expect, it } from "vitest";
import {
  applySanmarImagesToCatalogRows,
  assignSanmarColorImages,
  bestColorForUrl,
  bulkProductsToColorwayPatches,
  buildColorwayMediaPatches,
  pickStyleFallbackImage,
  urlMatchesColor,
} from "./color-images.js";
import type { CatalogSkuRow } from "../catalog/types.js";

const BLACK =
  "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg";
const GOLD =
  "https://media.sanmarcanada.com/catalog/product/1/0/108085_athletic_gold_2011.jpg";
const NAVY =
  "https://media.sanmarcanada.com/catalog/product/1/0/108085_navy_2011.jpg";
const BLACK_BACK =
  "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_back.jpg";
const STYLE_SHOT = "https://media.sanmarcanada.com/catalog/product/1/0/108085.jpg";

describe("urlMatchesColor / bestColorForUrl", () => {
  it("matches a _black_ filename to the Black colourway", () => {
    expect(urlMatchesColor(BLACK, "Black")).toBe(true);
    expect(urlMatchesColor(BLACK, "Navy")).toBe(false);
    expect(bestColorForUrl(BLACK, ["Black", "Athletic Gold", "Navy"])).toBe(
      "Black",
    );
  });

  it("prefers the longer colour name so TNF Black beats Black", () => {
    expect(
      bestColorForUrl(
        "https://media.example.com/NF0A529K_tnf_black_front.jpg",
        ["Black", "TNF Black"],
      ),
    ).toBe("TNF Black");
  });
});

describe("assignSanmarColorImages", () => {
  it("splits an enrich/media bag across colours instead of using urls[0]", () => {
    const assigned = assignSanmarColorImages({
      colorNames: ["Black", "Athletic Gold", "Navy"],
      mediaUrls: [GOLD, BLACK, NAVY, STYLE_SHOT],
    });

    expect(assigned.get("black")?.imageFront).toBe(BLACK);
    expect(assigned.get("athletic gold")?.imageFront).toBe(GOLD);
    expect(assigned.get("navy")?.imageFront).toBe(NAVY);
    expect(assigned.get("black")?.imageFront).not.toBe(GOLD);
    expect(assigned.get("navy")?.imageFront).not.toBe(GOLD);
  });

  it("does not assign the same gold URL to every colour", () => {
    const assigned = assignSanmarColorImages({
      colorNames: ["Black", "Navy", "Athletic Gold"],
      mediaUrls: [GOLD],
    });

    expect(assigned.get("athletic gold")?.imageFront).toBe(GOLD);
    expect(assigned.get("black")).toBeUndefined();
    expect(assigned.get("navy")).toBeUndefined();
    expect(pickStyleFallbackImage([GOLD], assigned)).toBe(GOLD);
  });

  it("classifies a named back shot onto that colour only", () => {
    const assigned = assignSanmarColorImages({
      colorNames: ["Black", "Navy"],
      mediaUrls: [BLACK, BLACK_BACK, NAVY],
    });
    expect(assigned.get("black")).toMatchObject({
      imageFront: BLACK,
      imageBack: BLACK_BACK,
    });
    expect(assigned.get("navy")?.imageBack).toBeUndefined();
  });
});

describe("bulkProductsToColorwayPatches", () => {
  it("writes each Bulk part image onto that colourway", () => {
    const patches = bulkProductsToColorwayPatches([
      {
        partId: "19920-1",
        styleId: "108085",
        colorName: "Black",
        sizeName: "OSFA",
        quantity: 10,
        imageUrl: BLACK,
      },
      {
        partId: "19920-2",
        styleId: "108085",
        colorName: "Athletic Gold",
        sizeName: "OSFA",
        quantity: 4,
        imageUrl: GOLD,
      },
      {
        partId: "19920-3",
        styleId: "108085",
        colorName: "Black",
        sizeName: "L",
        quantity: 2,
        imageUrl: BLACK,
      },
    ]);

    const byColor = new Map(
      patches.map((patch) => [patch.colorName.toLowerCase(), patch]),
    );
    expect(byColor.get("black")).toMatchObject({
      styleKey: "108085",
      colorName: "Black",
      imageFront: BLACK,
    });
    expect(byColor.get("athletic gold")?.imageFront).toBe(GOLD);
    expect(byColor.get("black")?.imageFront).not.toBe(GOLD);
    expect(patches).toHaveLength(2);
  });
});

describe("buildColorwayMediaPatches / applySanmarImagesToCatalogRows", () => {
  it("uses a ProductPart/Bulk hint even when the filename is unlabeled", () => {
    const patches = buildColorwayMediaPatches({
      styleKey: "108085",
      colorNames: ["Black", "Athletic Gold"],
      mediaUrls: [STYLE_SHOT],
      hints: [{ colorName: "Black", url: BLACK }],
    });
    const byColor = Object.fromEntries(
      patches.map((patch) => [patch.colorName, patch.imageFront]),
    );
    expect(byColor.Black).toBe(BLACK);
    expect(byColor["Athletic Gold"]).toBeUndefined();
  });

  it("does not copy a shared style-shot hint onto every SKU row", () => {
    const base = {
      styleKey: "108085",
      brandName: "OGIO",
      styleName: "Crunch Duffel",
      sizeName: "OSFA",
      qty: 0,
    };
    const rows = applySanmarImagesToCatalogRows(
      [
        {
          ...base,
          colorName: "Black",
          skuKey: "19920-1",
          sku: "19920-1",
          imageFront: GOLD,
        },
        {
          ...base,
          colorName: "Navy",
          skuKey: "19920-2",
          sku: "19920-2",
          imageFront: GOLD,
        },
        {
          ...base,
          colorName: "Athletic Gold",
          skuKey: "19920-3",
          sku: "19920-3",
          imageFront: GOLD,
        },
      ] satisfies CatalogSkuRow[],
      [GOLD],
    );

    expect(rows.find((row) => row.colorName === "Athletic Gold")?.imageFront).toBe(
      GOLD,
    );
    expect(rows.find((row) => row.colorName === "Black")?.imageFront).toBeUndefined();
    expect(rows.find((row) => row.colorName === "Navy")?.imageFront).toBeUndefined();
  });
});
