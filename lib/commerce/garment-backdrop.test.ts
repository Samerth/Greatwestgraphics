import { describe, expect, it } from "vitest";
import {
  GARMENT_FALLBACK,
  SLEEVE_TEMPLATE_LEFT,
  SLEEVE_TEMPLATE_RIGHT,
  garmentBackdropForSide,
  studioCanvasImageUrl,
} from "./garment-backdrop";

const PHOTOS = {
  colorFrontImageUrl: "https://cdn.example/front.jpg",
  colorBackImageUrl: "https://cdn.example/back.jpg",
  colorSideImageUrl: "https://cdn.example/side.jpg",
  styleImageUrl: "https://cdn.example/style.jpg",
};

describe("garmentBackdropForSide", () => {
  it("uses the vendor side photo for sleeves when one exists", () => {
    expect(garmentBackdropForSide("left", PHOTOS)).toEqual({
      url: PHOTOS.colorSideImageUrl,
      source: "photo",
      mirror: false,
    });
    expect(garmentBackdropForSide("right", PHOTOS)).toEqual({
      url: PHOTOS.colorSideImageUrl,
      source: "photo",
      mirror: true,
    });
  });

  it("does not put the chest photo on a sleeve view", () => {
    const noSide = { ...PHOTOS, colorSideImageUrl: null };
    expect(garmentBackdropForSide("left", noSide)).toEqual({
      url: SLEEVE_TEMPLATE_LEFT,
      source: "template",
      mirror: false,
    });
    expect(garmentBackdropForSide("right", noSide)).toEqual({
      url: SLEEVE_TEMPLATE_RIGHT,
      source: "template",
      mirror: false,
    });
    expect(garmentBackdropForSide("front", noSide).url).toBe(
      PHOTOS.colorFrontImageUrl,
    );
  });

  it("falls back to the generic tee only when even the front is missing", () => {
    expect(garmentBackdropForSide("front", {})).toEqual({
      url: GARMENT_FALLBACK,
      source: "template",
      mirror: false,
    });
  });
});

describe("studioCanvasImageUrl", () => {
  it("leaves local templates alone so SVG sleeves paint", () => {
    expect(
      studioCanvasImageUrl({
        url: SLEEVE_TEMPLATE_LEFT,
        source: "template",
        mirror: false,
      }),
    ).toBe(SLEEVE_TEMPLATE_LEFT);
  });

  it("sends remote photos through the image optimizer", () => {
    expect(
      studioCanvasImageUrl({
        url: "https://cdn.example/front.jpg",
        source: "photo",
        mirror: false,
      }),
    ).toContain("/_next/image?url=");
  });
});
