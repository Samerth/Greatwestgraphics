import { describe, expect, it } from "vitest";
import {
  filterStudioArticles,
  hexForColorName,
  normalizeStudioHex,
  studioArticleKey,
  studioArticleLabel,
  studioColorwayFill,
  studioColorwaysForArticle,
  studioColorwaysUseSwatches,
  studioDetailColorwaysForSelection,
  studioGarmentPhotos,
  studioVariantIdForColorway,
  uniqueStudioArticles,
} from "./studio-garments";

const navy = {
  id: "p-navy",
  label: "Gildan 5000",
  colorName: "Navy",
  brandName: "Gildan",
  styleName: "5000",
};
const black = {
  id: "p-black",
  label: "Gildan 5000",
  colorName: "Black",
  brandName: "Gildan",
  styleName: "5000",
};
const hoodie = {
  id: "p-hoodie",
  label: "Independent Trading SS4500",
  colorName: "Grey",
  brandName: "Independent Trading",
  styleName: "SS4500",
};

describe("studioArticleKey", () => {
  it("groups colourways of the same brand and style", () => {
    expect(studioArticleKey(navy)).toBe("Gildan::5000");
    expect(studioArticleKey(black)).toBe(studioArticleKey(navy));
    expect(studioArticleKey(hoodie)).not.toBe(studioArticleKey(navy));
  });

  it("falls back to the garment label when brand/style are missing", () => {
    expect(studioArticleKey({ id: "x", label: "Custom tee", colorName: "Red" })).toBe(
      "Custom tee",
    );
  });
});

describe("studioArticleLabel", () => {
  it("shows brand and style, not the colour name", () => {
    expect(studioArticleLabel(navy)).toBe("Gildan 5000");
  });
});

describe("uniqueStudioArticles", () => {
  it("collapses colourways to one article row", () => {
    expect(uniqueStudioArticles([navy, black, hoodie])).toEqual([
      { key: "Gildan::5000", label: "Gildan 5000", representativeId: "p-navy" },
      {
        key: "Independent Trading::SS4500",
        label: "Independent Trading SS4500",
        representativeId: "p-hoodie",
      },
    ]);
  });
});

describe("studioColorwaysForArticle", () => {
  it("lists catalogue colourways of the open article only", () => {
    expect(
      studioColorwaysForArticle({
        selectedId: "p-navy",
        garments: [navy, black, hoodie],
      }),
    ).toEqual([
      { id: "p-navy", colorName: "Navy" },
      { id: "p-black", colorName: "Black" },
    ]);
  });

  it("prefers the product-detail colorways list when present", () => {
    expect(
      studioColorwaysForArticle({
        selectedId: "p-navy",
        garments: [navy, hoodie],
        detailColorways: [
          { id: "p-navy", colorName: "Navy" },
          { id: "p-red", colorName: "Red" },
          { id: "p-white", colorName: "White" },
        ],
      }),
    ).toEqual([
      { id: "p-navy", colorName: "Navy" },
      { id: "p-red", colorName: "Red" },
      { id: "p-white", colorName: "White" },
    ]);
  });

  it("keeps sibling photos and hex from the product-detail list", () => {
    expect(
      studioColorwaysForArticle({
        selectedId: "p-navy",
        garments: [navy],
        detailColorways: [
          {
            id: "p-navy",
            colorName: "Navy",
            colorHex: "1b2a4a",
            frontImageUrl: "https://cdn.example/navy-front.jpg",
            sideImageUrl: "https://cdn.example/navy-side.jpg",
            backImageUrl: "https://cdn.example/navy-back.jpg",
            swatchImageUrl: "https://cdn.example/navy-swatch.jpg",
          },
          {
            id: "p-red",
            colorName: "Red",
            color1: "#c41e3a",
            frontImageUrl: "https://cdn.example/red-front.jpg",
          },
        ],
      }),
    ).toEqual([
      {
        id: "p-navy",
        colorName: "Navy",
        hex: "#1b2a4a",
        frontImageUrl: "https://cdn.example/navy-front.jpg",
        sideImageUrl: "https://cdn.example/navy-side.jpg",
        backImageUrl: "https://cdn.example/navy-back.jpg",
        swatchImageUrl: "https://cdn.example/navy-swatch.jpg",
      },
      {
        id: "p-red",
        colorName: "Red",
        hex: "#c41e3a",
        frontImageUrl: "https://cdn.example/red-front.jpg",
      },
    ]);
  });

  it("returns nothing until an article is chosen", () => {
    expect(
      studioColorwaysForArticle({
        selectedId: null,
        garments: [navy, black],
      }),
    ).toEqual([]);
  });
});

describe("studioDetailColorwaysForSelection", () => {
  const colorways = [
    { id: "p-navy", colorName: "Navy" },
    { id: "p-red", colorName: "Red" },
  ];

  it("keeps siblings while switching to another colour of the same style", () => {
    expect(
      studioDetailColorwaysForSelection({
        selectedId: "p-red",
        productId: "p-navy",
        colorways,
      }),
    ).toEqual(colorways);
  });

  it("drops a stale list when the shopper picks a different article", () => {
    expect(
      studioDetailColorwaysForSelection({
        selectedId: "p-hoodie",
        productId: "p-navy",
        colorways,
      }),
    ).toBeUndefined();
  });
});

describe("studioGarmentPhotos", () => {
  const navyProduct = {
    id: "p-navy",
    colorFrontImageUrl: "https://cdn.example/navy-front.jpg",
    colorSideImageUrl: "https://cdn.example/navy-side.jpg",
    colorBackImageUrl: "https://cdn.example/navy-back.jpg",
  };
  const redColorway = {
    frontImageUrl: "https://cdn.example/red-front.jpg",
    sideImageUrl: "https://cdn.example/red-side.jpg",
    backImageUrl: "https://cdn.example/red-back.jpg",
  };

  it("uses the loaded product photos when they match the selected colour", () => {
    expect(
      studioGarmentPhotos({
        selectedId: "p-navy",
        product: navyProduct,
        styleImageUrl: "https://cdn.example/style.jpg",
        selectedColorway: redColorway,
      }),
    ).toEqual({
      colorFrontImageUrl: navyProduct.colorFrontImageUrl,
      colorSideImageUrl: navyProduct.colorSideImageUrl,
      colorBackImageUrl: navyProduct.colorBackImageUrl,
      styleImageUrl: "https://cdn.example/style.jpg",
    });
  });

  it("switches the backdrop from sibling photos before the next detail fetch lands", () => {
    expect(
      studioGarmentPhotos({
        selectedId: "p-red",
        product: navyProduct,
        styleImageUrl: "https://cdn.example/style.jpg",
        selectedColorway: redColorway,
      }),
    ).toEqual({
      colorFrontImageUrl: redColorway.frontImageUrl,
      colorSideImageUrl: redColorway.sideImageUrl,
      colorBackImageUrl: redColorway.backImageUrl,
      styleImageUrl: "https://cdn.example/style.jpg",
    });
  });

  it("leaves a missing side photo empty so existing studio fallbacks apply", () => {
    expect(
      studioGarmentPhotos({
        selectedId: "p-red",
        product: navyProduct,
        selectedColorway: { frontImageUrl: "https://cdn.example/red-front.jpg" },
      }),
    ).toEqual({
      colorFrontImageUrl: "https://cdn.example/red-front.jpg",
      colorSideImageUrl: null,
      colorBackImageUrl: null,
      styleImageUrl: null,
    });
  });
});

describe("studioVariantIdForColorway", () => {
  const variants = [
    { id: "v-s", sizeName: "S", qty: 12, active: true },
    { id: "v-m", sizeName: "M", qty: 0, active: true },
    { id: "v-l", sizeName: "L", qty: 4, active: true },
  ];

  it("keeps the same size name on the next colourway", () => {
    expect(
      studioVariantIdForColorway({
        variants,
        preferredSizeName: "L",
      }),
    ).toBe("v-l");
  });

  it("falls back to the first in-stock size when the previous size is gone", () => {
    expect(
      studioVariantIdForColorway({
        variants: variants.filter((variant) => variant.sizeName !== "L"),
        preferredSizeName: "L",
      }),
    ).toBe("v-s");
  });
});

describe("studioColorwayFill", () => {
  it("normalizes vendor hex and maps common colour names", () => {
    expect(normalizeStudioHex("1B2A4A")).toBe("#1b2a4a");
    expect(hexForColorName("Sport Grey")).toBe("#8a8a8a");
    expect(studioColorwayFill({ id: "p-navy", colorName: "Navy" }).hex).toBe(
      "#1b2a4a",
    );
  });

  it("uses swatches when a hex or photo exists, otherwise a named select", () => {
    expect(
      studioColorwaysUseSwatches([{ id: "p-navy", colorName: "Navy" }]),
    ).toBe(true);
    expect(
      studioColorwaysUseSwatches([
        { id: "p-x", colorName: "Safety Orange Heather Twist" },
      ]),
    ).toBe(true);
    expect(
      studioColorwaysUseSwatches([{ id: "p-x", colorName: "Azalea Blast" }]),
    ).toBe(false);
  });
});

describe("filterStudioArticles", () => {
  const articles = uniqueStudioArticles([navy, hoodie]);

  it("filters by brand or style label", () => {
    expect(filterStudioArticles(articles, "gildan")).toEqual([
      { key: "Gildan::5000", label: "Gildan 5000", representativeId: "p-navy" },
    ]);
  });

  it("returns every article when the query is blank", () => {
    expect(filterStudioArticles(articles, "  ")).toEqual(articles);
  });
});
