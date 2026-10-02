import { describe, expect, it } from "vitest";
import {
  alignPatchesToCatalogueColours,
  applySanmarImagesToCatalogRows,
  assignSanmarColorImages,
  bestColorForUrl,
  bulkProductsToColorwayPatches,
  buildColorwayMediaPatches,
  pickStyleFallbackImage,
  sanmarColourKey,
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

  it("keeps SanMar Canada _modl_ studio shots and _flat_ product shots as separate fields", () => {
    const flat =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_flat_huckleberry_front_2025_cil.jpg";
    const model =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_modl_huckleberry_studio-front_crop_2025_cil.jpg";
    const views = assignSanmarColorImages({
      colorNames: ["Huckleberry"],
      mediaUrls: [flat, model],
    }).get("huckleberry");
    expect(views?.imageFront).toBe(flat);
    expect(views?.imageFrontOnModel).toBe(model);
  });

  it("keeps the flat shot as imageFront and the on-model shot separate, regardless of feed order", () => {
    const flat =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_flat.jpg";
    const model =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_omf.jpg";

    // imageFront is the Design Studio's own backdrop (Pavin: "images in the
    // studio should just be the product, not the [model]") — it must be the
    // flat shot regardless of feed order. imageFrontOnModel carries the
    // model shot separately, for the catalogue tile
    // (`catalogCardImageUrl` — CodSphere UAT: "Use model/on-body product
    // imagery as the primary catalogue image wherever available").
    const forward = assignSanmarColorImages({
      colorNames: ["Black"],
      mediaUrls: [flat, model],
    }).get("black");
    expect(forward?.imageFront).toBe(flat);
    expect(forward?.imageFrontOnModel).toBe(model);

    // Order reversed — same result either way.
    const reversed = assignSanmarColorImages({
      colorNames: ["Black"],
      mediaUrls: [model, flat],
    }).get("black");
    expect(reversed?.imageFront).toBe(flat);
    expect(reversed?.imageFrontOnModel).toBe(model);
  });

  it("falls back imageFrontOnModel to the same model shot when no flat shot exists", () => {
    const model =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_omf.jpg";
    const views = assignSanmarColorImages({
      colorNames: ["Black"],
      mediaUrls: [model],
    }).get("black");
    // No flat shot was ever sent for this colourway — the studio still
    // needs *something* to draw, so imageFront falls back to the model
    // shot rather than being empty. imageFrontOnModel names the same URL,
    // so a caller can tell the two apart from what's actually a flat shot.
    expect(views?.imageFront).toBe(model);
    expect(views?.imageFrontOnModel).toBe(model);
  });

  it("falls back to the flat/ghost shot when no model shot exists", () => {
    const assigned = assignSanmarColorImages({
      colorNames: ["Black"],
      mediaUrls: [BLACK],
    });
    expect(assigned.get("black")?.imageFront).toBe(BLACK);
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

  it("keeps a Bulk model shot off imageFront so it can never replace the flat studio garment", () => {
    const MODEL =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_studio-front_black.jpg";
    const patches = bulkProductsToColorwayPatches([
      {
        partId: "19920-1",
        styleId: "108085",
        colorName: "Black",
        sizeName: "S",
        quantity: 1,
        imageUrl: MODEL,
      },
      {
        partId: "19920-2",
        styleId: "108085",
        colorName: "Black",
        sizeName: "M",
        quantity: 1,
        imageUrl: BLACK,
      },
    ]);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      colorName: "Black",
      imageFront: BLACK,
      imageFrontOnModel: MODEL,
    });
  });

  it("with only a model shot, leaves imageFront empty rather than filling it with the model", () => {
    const MODEL =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_studio-front_black.jpg";
    const [patch] = bulkProductsToColorwayPatches([
      {
        partId: "19920-1",
        styleId: "108085",
        colorName: "Black",
        sizeName: "S",
        quantity: 1,
        imageUrl: MODEL,
      },
    ]);
    expect(patch?.imageFront).toBeUndefined();
    expect(patch?.imageFrontOnModel).toBe(MODEL);
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

describe("sanmarColourKey", () => {
  // Pairs taken from the real SanMar staging catalogue (left) and the 1 Oct
  // 2026 Bulk reply (right).
  it.each([
    ["Charcoal Hthr", "Charcoal Heather*"],
    ["Dk Hthr Grey", "Dark Heather Grey"],
    ["Dark HthrGrey", "Dark Heather Grey**"],
    ["LapisBlueFrst", "lapis blue frost"],
    ["Flag Blk/Wht", "Flag Black/White"],
    ["Multicam/Blk", "Multicam®*/Black"],
    ["BLK/WHITE/WH", "Black/White/White"],
    ["CoalGrey/Blk", "Coal Grey/Black"],
  ])("treats %j and %j as the same colour", (catalogue, bulk) => {
    expect(sanmarColourKey(catalogue)).toBe(sanmarColourKey(bulk));
  });

  it.each([
    ["Black", "Black/White"],
    ["Navy", "Earth Black"],
    ["Heather", "Dark Heather"],
    ["Char/Navy", "Charcoal Heather/Navy"],
  ])("keeps %j and %j apart", (a, b) => {
    expect(sanmarColourKey(a)).not.toBe(sanmarColourKey(b));
  });

  it("is empty for a missing name", () => {
    expect(sanmarColourKey(undefined)).toBe("");
    expect(sanmarColourKey("  ")).toBe("");
  });
});

describe("alignPatchesToCatalogueColours", () => {
  const patch = (styleKey: string, colorName: string) => ({
    styleKey,
    colorName,
    imageFront: `https://media.example.com/${styleKey}/${colorName}.jpg`,
  });

  it("renames a Bulk colour to the catalogue's own spelling", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("ATC8064L", "Charcoal Heather*")],
      new Map([["ATC8064L", ["Charcoal Hthr", "Black"]]]),
    );
    expect(renamed).toBe(1);
    expect(patches[0]?.colorName).toBe("Charcoal Hthr");
    // Only the label changes; the photo that came with it is kept.
    expect(patches[0]?.imageFront).toContain("Charcoal Heather*");
  });

  it("leaves a colour that already matches exactly", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("S1", "Black")],
      new Map([["S1", ["black"]]]),
    );
    expect(renamed).toBe(0);
    expect(patches[0]?.colorName).toBe("Black");
  });

  it("does not guess when two catalogue colours share the same key", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("S1", "Charcoal Heather")],
      new Map([["S1", ["Charcoal Hthr", "Charcoal Heather*"]]]),
    );
    expect(renamed).toBe(0);
    expect(patches[0]?.colorName).toBe("Charcoal Heather");
  });

  it("does not take a colour another patch already names exactly", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("S1", "Charcoal Heather"), patch("S1", "Charcoal Heather*")],
      new Map([["S1", ["Charcoal Heather"]]]),
    );
    expect(renamed).toBe(0);
    expect(patches.map((p) => p.colorName)).toEqual([
      "Charcoal Heather",
      "Charcoal Heather*",
    ]);
  });

  it("renames neither patch when two would land on the same catalogue colour", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("S1", "Charcoal Heather*"), patch("S1", "Charcoal Heather**")],
      new Map([["S1", ["Charcoal Hthr"]]]),
    );
    expect(renamed).toBe(0);
    expect(patches[0]?.colorName).toBe("Charcoal Heather*");
  });

  it("uses the catalogue's capitals for a style code (WeRK250 vs WERK250)", () => {
    // Real: 319 staging parts differed from Bulk only in the case of the style.
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("WeRK250", "Black")],
      new Map([["WERK250", ["Black"]]]),
    );
    expect(renamed).toBe(1);
    expect(patches[0]?.styleKey).toBe("WERK250");
    expect(patches[0]?.colorName).toBe("Black");
  });

  it("fixes the style and the colour name on the same patch", () => {
    const { patches } = alignPatchesToCatalogueColours(
      [patch("WeRK250", "Charcoal Heather*")],
      new Map([["WERK250", ["Charcoal Hthr"]]]),
    );
    expect(patches[0]).toMatchObject({
      styleKey: "WERK250",
      colorName: "Charcoal Hthr",
    });
  });

  it("does not guess between two catalogue styles that differ only in case", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("abc1", "Black")],
      new Map([
        ["ABC1", ["Black"]],
        ["Abc1", ["Black"]],
      ]),
    );
    expect(renamed).toBe(0);
    expect(patches[0]?.styleKey).toBe("abc1");
  });

  it("leaves a style the catalogue does not hold, and a colour with no match", () => {
    const { patches, renamed } = alignPatchesToCatalogueColours(
      [patch("NOPE", "Black"), patch("S1", "Black/White")],
      new Map([["S1", ["Black"]]]),
    );
    expect(renamed).toBe(0);
    expect(patches.map((p) => p.colorName)).toEqual(["Black", "Black/White"]);
  });
});
