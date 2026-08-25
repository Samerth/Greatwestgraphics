import { describe, expect, it } from "vitest";
import { garmentBackdropForSide } from "./garment-backdrop";
import {
  DEFAULT_SLEEVE_FILL_HEX,
  DESIGN_SIDE_THUMB_LABELS,
  isStudioSleeveSide,
  sleeveIllustrationModel,
  sleeveIllustrationSvg,
  sleeveOutlineHex,
  studioSleeveFillFromColorway,
  studioSleeveFillHex,
} from "./studio-sleeve";

const PHOTOS = {
  colorFrontImageUrl: "https://cdn.example/front.jpg",
  colorBackImageUrl: "https://cdn.example/back.jpg",
  colorSideImageUrl: "https://cdn.example/side.jpg",
  styleImageUrl: "https://cdn.example/style.jpg",
};

describe("studioSleeveFillHex", () => {
  it("uses the selected colourway hex", () => {
    expect(studioSleeveFillHex({ hex: "1B2A4A", colorName: "Red" })).toBe(
      "#1b2a4a",
    );
    expect(
      studioSleeveFillFromColorway({ colorName: "Navy", hex: "#1b2a4a" }),
    ).toBe("#1b2a4a");
  });

  it("falls back to the named-colour map, then a neutral fill", () => {
    expect(studioSleeveFillHex({ colorName: "Forest" })).toBe("#1f4d2e");
    expect(studioSleeveFillHex({ colorName: "Navy" })).toBe("#1b2a4a");
    expect(studioSleeveFillFromColorway({ colorName: "Azalea Blast" })).toBe(
      DEFAULT_SLEEVE_FILL_HEX,
    );
  });
});

describe("sleeve illustrations", () => {
  it("binds the fill path to the selected hex and recolors immediately", () => {
    const navy = sleeveIllustrationSvg({ side: "left", fillHex: "#1b2a4a" });
    const red = sleeveIllustrationSvg({ side: "left", fillHex: "#c41e3a" });

    expect(navy).toContain('data-sleeve-fill="#1b2a4a"');
    expect(navy).toContain('data-sleeve-part="fill"');
    expect(navy).toContain('fill="#1b2a4a"');
    expect(navy).toContain("stroke=");
    expect(red).toContain('data-sleeve-fill="#c41e3a"');
    expect(red).toContain('fill="#c41e3a"');
    expect(red).not.toContain("#1b2a4a");
    expect(navy).not.toContain("#c41e3a");
  });

  it("keeps left and right as distinct mirrored plates", () => {
    const left = sleeveIllustrationModel({ side: "left", fillHex: "#c41e3a" });
    const right = sleeveIllustrationModel({ side: "right", fillHex: "#c41e3a" });

    expect(left.side).toBe("left");
    expect(right.side).toBe("right");
    expect(left.garmentPath).not.toBe(right.garmentPath);
    expect(left.cuffNotchPath).not.toBe(right.cuffNotchPath);
    expect(left.fillHex).toBe(right.fillHex);
    expect(sleeveIllustrationSvg({ side: "left", fillHex: "#c41e3a" })).not.toBe(
      sleeveIllustrationSvg({ side: "right", fillHex: "#c41e3a" }),
    );
    expect(sleeveIllustrationSvg({ side: "left", fillHex: "#c41e3a" })).toContain(
      'data-sleeve-side="left"',
    );
    expect(sleeveIllustrationSvg({ side: "right", fillHex: "#c41e3a" })).toContain(
      'data-sleeve-side="right"',
    );
  });

  it("uses a contrasting outline so the line-art stays visible", () => {
    expect(sleeveOutlineHex("#111111")).toBe("#f3f1ec");
    expect(sleeveOutlineHex("#f4f4f4")).toBe("#1c1c1c");
  });
});

describe("photo sides stay photographic", () => {
  it("uses vendor photos for front, back, and both sleeves", () => {
    expect(isStudioSleeveSide("front")).toBe(false);
    expect(isStudioSleeveSide("back")).toBe(false);
    expect(isStudioSleeveSide("left")).toBe(true);
    expect(isStudioSleeveSide("right")).toBe(true);
    expect(garmentBackdropForSide("front", PHOTOS)).toEqual({
      url: PHOTOS.colorFrontImageUrl,
      source: "photo",
      mirror: false,
    });
    expect(garmentBackdropForSide("back", PHOTOS)).toEqual({
      url: PHOTOS.colorBackImageUrl,
      source: "photo",
      mirror: false,
    });
    expect(garmentBackdropForSide("left", PHOTOS)).toEqual({
      url: PHOTOS.colorSideImageUrl,
      source: "photo",
      mirror: false,
      plate: true,
    });
    expect(garmentBackdropForSide("right", PHOTOS)).toEqual({
      url: PHOTOS.colorSideImageUrl,
      source: "photo",
      mirror: true,
      plate: true,
    });
    expect(garmentBackdropForSide("left", { ...PHOTOS, colorSideImageUrl: null })).toMatchObject({
      source: "side-view",
      plate: true,
    });
    expect(DESIGN_SIDE_THUMB_LABELS.left).toBe("L.Sleeve");
    expect(DESIGN_SIDE_THUMB_LABELS.right).toBe("R.Sleeve");
  });
});
