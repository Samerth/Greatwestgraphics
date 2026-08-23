import { describe, expect, it } from "vitest";
import {
  GARMENT_FALLBACK,
  SLEEVE_TEMPLATE_LEFT,
  SLEEVE_TEMPLATE_RIGHT,
  distinctPhoto,
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

  it("rejects a side URL that is just the front or style chest shot", () => {
    expect(
      garmentBackdropForSide("left", {
        ...PHOTOS,
        colorSideImageUrl: PHOTOS.colorFrontImageUrl,
      }).url,
    ).toBe(SLEEVE_TEMPLATE_LEFT);
    expect(
      garmentBackdropForSide("right", {
        ...PHOTOS,
        colorSideImageUrl: PHOTOS.styleImageUrl,
      }).url,
    ).toBe(SLEEVE_TEMPLATE_RIGHT);
  });

  it("falls back to the generic tee only when even the front is missing", () => {
    expect(garmentBackdropForSide("front", {})).toEqual({
      url: GARMENT_FALLBACK,
      source: "template",
      mirror: false,
    });
  });
});

describe("distinctPhoto", () => {
  it("drops blanks and duplicates of the avoided URLs", () => {
    expect(distinctPhoto("  https://cdn.example/side.jpg  ")).toBe(
      "https://cdn.example/side.jpg",
    );
    expect(distinctPhoto("https://cdn.example/front.jpg", PHOTOS.colorFrontImageUrl)).toBe(
      null,
    );
    expect(distinctPhoto("   ", PHOTOS.colorFrontImageUrl)).toBe(null);
  });
});

describe("studioCanvasImageUrl", () => {
  it("leaves local templates alone so sleeve JPEGs paint", () => {
    expect(
      studioCanvasImageUrl({
        url: SLEEVE_TEMPLATE_LEFT,
        source: "template",
        mirror: false,
      }),
    ).toBe(SLEEVE_TEMPLATE_LEFT);
  });

  it("does not send SVG through the image optimizer", () => {
    expect(
      studioCanvasImageUrl({
        url: "/images/studio/custom.svg",
        source: "photo",
        mirror: false,
      }),
    ).toBe("/images/studio/custom.svg");
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
