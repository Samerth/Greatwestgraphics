import { describe, expect, it } from "vitest";
import {
  filterStudioArticles,
  studioArticleKey,
  studioArticleLabel,
  studioColorwaysForArticle,
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

  it("returns nothing until an article is chosen", () => {
    expect(
      studioColorwaysForArticle({
        selectedId: null,
        garments: [navy, black],
      }),
    ).toEqual([]);
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
