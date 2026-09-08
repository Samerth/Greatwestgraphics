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

  it("prefers S&S's own on-model field over the flat shot and style image outright", () => {
    // S&S names this field explicitly (colorOnModelFrontImage) rather than
    // making us guess from a filename the way SanMar's media bag does, so
    // it wins without going through isCatalogModelShot at all.
    const onModel =
      "https://cdn.ssactivewear.com/Images/OnModel/115711_omf_fm.jpg";
    const flat = "https://cdn.ssactivewear.com/Images/Color/115711_f_fm.jpg";
    const style = "https://cdn.ssactivewear.com/Images/Style/115711_fm.jpg";
    expect(
      catalogCardImageUrl({
        colorOnModelFrontImageUrl: onModel,
        colorFrontImageUrl: flat,
        styleImageUrl: style,
      }),
    ).toBe(onModel);
  });

  it("SanMar rows (no on-model field) are unaffected by the new param", () => {
    const flat =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_flat_huckleberry_front_2025_cil.jpg";
    const model =
      "https://media.sanmarcanada.com/catalog/product/a/l/al2004ca_modl_huckleberry_studio-front_crop_2025_cil.jpg";
    expect(
      catalogCardImageUrl({
        colorFrontImageUrl: flat,
        styleImageUrl: model,
        colorOnModelFrontImageUrl: undefined,
      }),
    ).toBe(model);
  });
});
