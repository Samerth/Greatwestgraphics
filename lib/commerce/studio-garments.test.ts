import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterStudioArticles,
  hexForColorName,
  normalizeStudioHex,
  pdpColorwaySwatch,
  studioArticleKey,
  studioArticleLabel,
  studioColorwayFill,
  UNRESOLVED_SWATCH_HEX,
  studioColorwaysForArticle,
  studioColorwaysUseSwatches,
  studioDetailColorwaysForSelection,
  studioGarmentPhotos,
  studioRosterSizeOptions,
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
      styleName: null,
      styleTitle: null,
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
      styleName: null,
      styleTitle: null,
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
      styleName: null,
      styleTitle: null,
    });
  });

  it("keeps the manufacturer title so hoodie plates can key off it", () => {
    expect(
      studioGarmentPhotos({
        selectedId: "p-hoodie",
        styleName: "A2009",
        styleTitle: "Men's Ultimate365 Elevated Hoodie",
      }),
    ).toMatchObject({
      styleName: "A2009",
      styleTitle: "Men's Ultimate365 Elevated Hoodie",
    });
  });
});

describe("studioRosterSizeOptions", () => {
  it("uses in-stock sizes, or every size when none are in stock", () => {
    expect(
      studioRosterSizeOptions([
        { id: "v-s", sizeName: "S", qty: 12, active: true },
        { id: "v-m", sizeName: "M", qty: 0, active: true },
        { id: "v-l", sizeName: "L", qty: 4, active: true },
      ]),
    ).toEqual([
      { id: "v-s", label: "S" },
      { id: "v-l", label: "L" },
    ]);
    expect(
      studioRosterSizeOptions([
        { id: "v-s", sizeName: "S", qty: 0, active: true },
        { id: "v-m", sizeName: "M", qty: 0, active: true },
      ]),
    ).toEqual([
      { id: "v-s", label: "S" },
      { id: "v-m", label: "M" },
    ]);
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
    // Was #8a8a8a, reached by falling through to the bare "grey". Sport Grey
    // is a specific light heather, so it now has its own entry rather than
    // borrowing the generic mid-grey (CodSphere UAT V2 rows 44/45).
    expect(hexForColorName("Sport Grey")).toBe("#a3a3a3");
    expect(hexForColorName("grey")).toBe("#8a8a8a");
    expect(hexForColorName("Arctic Blue")).toBe("#7eb8d4");
    expect(hexForColorName("Athletic Gold")).toBe("#d4a017");
    expect(hexForColorName("NightSkyNavy")).toBe("#1b2a4a");
    expect(hexForColorName("RevolutionRed")).toBe("#c41e3a");
    expect(hexForColorName("Beacon Blue")).toBe("#4f8fba");
    expect(hexForColorName("Lime")).toBe("#b5d33d");
    expect(hexForColorName("Hunter")).toBe("#355e3b");
    expect(studioColorwayFill({ id: "p-navy", colorName: "Navy" }).hex).toBe(
      "#1b2a4a",
    );
  });

  it("fills PDP swatches from hex or the colour name, never a shared style shot", () => {
    expect(
      pdpColorwaySwatch({
        colorName: "Arctic Blue",
        colorHex: null,
        swatchImageUrl: null,
        frontImageUrl: null,
      }),
    ).toEqual({ imageUrl: null, hex: "#7eb8d4" });
    expect(
      pdpColorwaySwatch({
        colorName: "Athletic Gold",
        color1: null,
        swatchImageUrl: "",
        frontImageUrl: "",
      }),
    ).toEqual({ imageUrl: null, hex: "#d4a017" });
    expect(
      pdpColorwaySwatch({
        colorName: "Black / Black",
        colorHex: null,
      }),
    ).toEqual({ imageUrl: null, hex: "#111111" });
    // Row 44: the vendor photo used to win here, which is what put a picture
    // of the garment inside the swatch circle. A real hex now beats it.
    expect(
      pdpColorwaySwatch({
        colorName: "Navy",
        colorHex: "1b2a4a",
        swatchImageUrl: "https://cdn.example/navy-swatch.jpg",
      }),
    ).toEqual({ imageUrl: null, hex: "#1b2a4a" });

    // This used to fall back to the photo when no colour could be determined
    // — which is exactly the picture-in-a-circle row 44 reported, on every
    // product whose name the lookup did not know. A neutral fill now, always.
    expect(
      pdpColorwaySwatch({
        colorName: "Mombasa Twist",
        colorHex: null,
        swatchImageUrl: "https://cdn.example/unknown-swatch.jpg",
      }),
    ).toEqual({
      imageUrl: null,
      hex: UNRESOLVED_SWATCH_HEX,
    });
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
    // "Azalea Blast" used to land here; azalea is a real apparel pink and is
    // now recognised, so this needs a name carrying no colour word at all.
    expect(
      studioColorwaysUseSwatches([{ id: "p-x", colorName: "Mombasa Twist" }]),
    ).toBe(false);
  });

  /**
   * Rows 44 and 45 are one defect: a swatch painted from a photograph rather
   * than from the colour. On the product page the photo beat an available
   * hex; in the studio the colour-name table was too small to produce a hex
   * for most real colourways, so it fell through to a remote vendor image
   * that could fail to load — the "swatches are not loading" report.
   */
  it("resolves the everyday catalogue colour names the old table missed", () => {
    for (const name of [
      "Athletic Heather",
      "Dark Heather",
      "Carolina Blue",
      "Vegas Gold",
      "Kelly Green",
      "Safety Green",
      "Heather Grey",
      "Light Grey",
      "Burgundy",
      "Cardinal",
      "Hot Pink",
      "Olive",
      "Charcoal",
      "Sand",
    ]) {
      expect(hexForColorName(name), `${name} should resolve`).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
  });

  it("prefers the qualified name over the bare colour inside it", () => {
    expect(hexForColorName("Light Grey")).not.toBe(hexForColorName("grey"));
    expect(hexForColorName("Safety Green")).not.toBe(hexForColorName("green"));
    expect(hexForColorName("Forest Green")).not.toBe(hexForColorName("green"));
  });

  it("ignores qualifier words that describe rather than name a colour", () => {
    // "Heather" must not outrank the orange it is qualifying.
    expect(hexForColorName("Safety Orange Heather Twist")).toBe(
      hexForColorName("Safety Orange"),
    );
  });
});

describe("PDP colour row", () => {
  it("shows Colour for a single colorway and paints from pdpColorwaySwatch", () => {
    const page = readFileSync(
      resolve(process.cwd(), "app/(shop)/product/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("pdpColorwaySwatch");
    expect(page).toContain("colorways.length > 0");
    expect(page).not.toContain("colorways.length > 1");
    expect(page).not.toMatch(
      /swatchImageUrl[\s\S]{0,80}styleImageUrl|styleImageUrl[\s\S]{0,80}swatch/,
    );
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

/**
 * Reported on 14 September, on the ATC Y3550 product page: one swatch still
 * showed a photo of the garment. The vendor had shipped no hex for any colour
 * on the style, so every swatch depended on the name lookup — and "Carolina"
 * was not in it. A scan of the whole catalogue then found 129 of 520 no-hex
 * names failed the same way. Every name below is real, taken from that scan.
 */
describe("colour names as vendors actually ship them", () => {
  it("knows the bare colour names that were missing", () => {
    for (const name of [
      "Carolina", "Caramel", "Pewter", "Sangria", "Spruce", "Anthracite",
      "Terracotta", "Huckleberry", "Midnight", "Chrome", "Concrete", "Dove",
    ]) {
      expect(hexForColorName(name), name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("expands vendor shorthand", () => {
    expect(hexForColorName("Athletic Hthr")).toBe(hexForColorName("Athletic Heather"));
    expect(hexForColorName("Dark Hthr Gry")).toBe(hexForColorName("Dark Heather Grey"));
    expect(hexForColorName("Team DrkHthr")).toBe(hexForColorName("Dark Heather"));
    expect(hexForColorName("Team FrstGrn")).toBe(hexForColorName("Forest Green"));
    expect(hexForColorName("AthleticOxfrd")).toBe(hexForColorName("Athletic Oxford"));
  });

  it("copes with names the vendor truncates at thirteen characters", () => {
    expect(hexForColorName("BrilliantOran")).toBe(hexForColorName("Brilliant Orange"));
    expect(hexForColorName("Extreme Yello")).toBe(hexForColorName("Extreme Yellow"));
    expect(hexForColorName("Dark Chocolat")).toBe(hexForColorName("Dark Chocolate"));
  });

  it("takes the body colour of a trim combination, not the trim", () => {
    // "Crem/Nav/Gry" is a cream garment with navy and grey trim. Scanning
    // right to left would have painted it grey.
    expect(hexForColorName("Crem/Nav/Gry")).toBe(hexForColorName("Cream"));
    expect(hexForColorName("Carolina/Coal")).toBe(hexForColorName("Carolina"));
    expect(hexForColorName("CARA/BLK/BLK")).toBe(hexForColorName("Caramel"));
    expect(hexForColorName("Concrete/Wht")).toBe(hexForColorName("Concrete"));
  });

  it("drops collection prefixes that are not colours", () => {
    expect(hexForColorName("Flag Roy/Wht")).toBe(hexForColorName("Royal"));
    expect(hexForColorName("TNF DrkGryHth")).toBe(hexForColorName("Dark Grey Heather"));
  });

  it("still returns nothing for a name that is not a colour", () => {
    // These are the catalogue's internal items — the neutral fill is right.
    for (const name of ["Sample", "Location", "Backpack", "English Logo", "ATC"]) {
      expect(hexForColorName(name), name).toBeNull();
    }
  });
});

describe("a swatch is always a fill, never a photo (row 44)", () => {
  const photo = "https://media.sanmarcanada.com/x/front.jpg";

  it("paints a neutral fill when the name cannot be resolved", () => {
    const fill = pdpColorwaySwatch({ colorName: "Sample", frontImageUrl: photo });
    expect(fill.hex).toBe(UNRESOLVED_SWATCH_HEX);
    expect(fill.imageUrl).toBeNull();
  });

  it("does the same in the studio", () => {
    const fill = studioColorwayFill({
      colorName: "Sample",
      hex: null,
      swatchImageUrl: photo,
      frontImageUrl: photo,
    } as never);
    expect(fill.hex).toBe(UNRESOLVED_SWATCH_HEX);
    expect(fill.imageUrl).toBeNull();
  });

  it("never returns an image URL from either helper", () => {
    // The photo-in-a-circle is the exact thing the row reported.
    for (const name of ["Black", "Carolina", "Crem/Nav/Gry", "Sample", ""]) {
      expect(pdpColorwaySwatch({ colorName: name, frontImageUrl: photo }).imageUrl).toBeNull();
    }
  });

  it("still prefers a real vendor hex over the lookup", () => {
    expect(pdpColorwaySwatch({ colorName: "Carolina", colorHex: "#123456" }).hex).toBe("#123456");
  });
});
