import { describe, expect, it } from "vitest";
import {
  catalogCardImageUrl,
  isCatalogFlatShot,
  isCatalogModelShot,
  isSsStyleHero,
} from "./catalog-images";

describe("catalog card image", () => {
  it("prefers a SanMar on-model studio shot over the flat garment photo", () => {
    const flat =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_flat_huckleberry_front_2025_cil.jpg";
    const model =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_modl_huckleberry_studio-front_crop_2025_cil.jpg";
    expect(isCatalogModelShot(model)).toBe(true);
    expect(isCatalogFlatShot(flat)).toBe(true);
    expect(
      catalogCardImageUrl({
        colorFrontImageUrl: flat,
        styleImageUrl: model,
      }),
    ).toBe(model);
  });

  it("prefers the S&S style hero over the colour-folder garment shot", () => {
    const color =
      "https://cdn.ssactivewear.com/Images/Color/115711_f_fm.jpg";
    const style = "https://cdn.ssactivewear.com/Images/Style/115711_fm.jpg";
    expect(isSsStyleHero(style)).toBe(true);
    expect(isCatalogModelShot(color)).toBe(false);
    expect(
      catalogCardImageUrl({
        colorFrontImageUrl: color,
        styleImageUrl: style,
      }),
    ).toBe(style);
  });

  it("falls back to the colour garment shot when that is all we have", () => {
    const color =
      "https://cdn.ssactivewear.com/Images/Color/115711_f_fm.jpg";
    expect(
      catalogCardImageUrl({
        colorFrontImageUrl: color,
        styleImageUrl: null,
      }),
    ).toBe(color);
  });
});
