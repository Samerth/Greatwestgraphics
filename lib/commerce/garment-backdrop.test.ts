import { describe, expect, it } from "vitest";
import {
  GARMENT_FALLBACK,
  SLEEVE_PLATE_INSET,
  STUDIO_SIDE_HOODIE,
  STUDIO_SIDE_TEE,
  backdropImageStyle,
  distinctPhoto,
  framedBackdropStyles,
  garmentBackdropForSide,
  namedVendorView,
  plateContainRect,
  studioCanvasImageUrl,
  studioSideViewTemplate,
  usableSidePhoto,
  type PhotoCrop,
} from "./garment-backdrop";

const SAMPLE_CROP: PhotoCrop = {
  x: 0.46,
  y: 0.02,
  width: 0.52,
  height: 0.7,
};

const PHOTOS = {
  colorFrontImageUrl: "https://cdn.example/front.jpg",
  colorBackImageUrl: "https://cdn.example/back.jpg",
  colorSideImageUrl: "https://cdn.example/side.jpg",
  styleImageUrl: "https://cdn.example/style.jpg",
};

describe("garmentBackdropForSide", () => {
  it("uses the vendor side photo as a framed sleeve plate when one exists", () => {
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
  });

  it("uses a photorealistic side plate when the vendor omitted a side shot", () => {
    const noSide = { ...PHOTOS, colorSideImageUrl: null, styleName: "Essential Hoodie" };
    expect(garmentBackdropForSide("left", noSide)).toEqual({
      url: STUDIO_SIDE_HOODIE,
      source: "side-view",
      mirror: false,
      plate: true,
    });
    expect(garmentBackdropForSide("right", noSide)).toEqual({
      url: STUDIO_SIDE_HOODIE,
      source: "side-view",
      mirror: true,
      plate: true,
    });
    expect(garmentBackdropForSide("front", noSide)).toEqual({
      url: PHOTOS.colorFrontImageUrl,
      source: "photo",
      mirror: false,
    });
    expect(garmentBackdropForSide("left", { ...noSide, styleName: "Ring-spun Tee" })).toEqual({
      url: STUDIO_SIDE_TEE,
      source: "side-view",
      mirror: false,
      plate: true,
    });
  });

  it("rejects a side URL that is just the front or style chest shot", () => {
    expect(
      garmentBackdropForSide("left", {
        ...PHOTOS,
        colorSideImageUrl: PHOTOS.colorFrontImageUrl,
      }),
    ).toMatchObject({
      url: STUDIO_SIDE_TEE,
      source: "side-view",
      plate: true,
    });
    expect(
      garmentBackdropForSide("right", {
        ...PHOTOS,
        colorSideImageUrl: PHOTOS.styleImageUrl,
      }),
    ).toMatchObject({
      url: STUDIO_SIDE_TEE,
      source: "side-view",
      mirror: true,
      plate: true,
    });
  });

  it("rejects a side URL that is just the back shot", () => {
    expect(
      garmentBackdropForSide("left", {
        ...PHOTOS,
        colorSideImageUrl: PHOTOS.colorBackImageUrl,
      }),
    ).toMatchObject({
      url: STUDIO_SIDE_TEE,
      source: "side-view",
      plate: true,
    });
  });

  it("rejects a side URL whose filename is a front or back shot", () => {
    expect(
      garmentBackdropForSide("left", {
        ...PHOTOS,
        colorSideImageUrl: "https://cdn.example/color_front.jpg",
      }),
    ).toMatchObject({ source: "side-view", url: STUDIO_SIDE_TEE, plate: true });
    expect(
      garmentBackdropForSide("right", {
        ...PHOTOS,
        colorSideImageUrl: "https://cdn.example/17190_b_fm.jpg",
      }),
    ).toMatchObject({ source: "side-view", url: STUDIO_SIDE_TEE, mirror: true, plate: true });
  });

  it("falls back to the generic tee only when even the front is missing", () => {
    expect(garmentBackdropForSide("front", {})).toEqual({
      url: GARMENT_FALLBACK,
      source: "template",
      mirror: false,
    });
    expect(garmentBackdropForSide("left", {})).toEqual({
      url: STUDIO_SIDE_TEE,
      source: "side-view",
      mirror: false,
      plate: true,
    });
  });
});

describe("studioSideViewTemplate", () => {
  it("picks the hoodie plate for fleece and the tee plate otherwise", () => {
    expect(studioSideViewTemplate("Coastal Hoodie")).toBe(STUDIO_SIDE_HOODIE);
    expect(studioSideViewTemplate("Crew Fleece")).toBe(STUDIO_SIDE_HOODIE);
    expect(studioSideViewTemplate("Ring-spun Tee")).toBe(STUDIO_SIDE_TEE);
    expect(studioSideViewTemplate(null)).toBe(STUDIO_SIDE_TEE);
  });
});

describe("namedVendorView", () => {
  it("reads the angle from the filename", () => {
    expect(namedVendorView("https://cdn.example/front.jpg")).toBe("front");
    expect(namedVendorView("https://cdn.example/17190_b_fm.jpg")).toBe("back");
    expect(namedVendorView("https://cdn.example/color_side.jpg")).toBe("side");
    expect(namedVendorView("https://cdn.example/17190_s_fm.jpg")).toBe("side");
    expect(
      namedVendorView(
        "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg",
      ),
    ).toBe(null);
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

describe("usableSidePhoto", () => {
  it("keeps an unlabeled distinct side URL", () => {
    expect(
      usableSidePhoto("https://cdn.ssactivewear.com/Images/Color/17190.jpg", PHOTOS.colorFrontImageUrl),
    ).toBe("https://cdn.ssactivewear.com/Images/Color/17190.jpg");
  });

  it("drops a URL named as the chest or back", () => {
    expect(usableSidePhoto("https://cdn.example/front.jpg")).toBe(null);
    expect(usableSidePhoto("https://cdn.example/back.jpg")).toBe(null);
  });
});

describe("studioCanvasImageUrl", () => {
  it("leaves local images alone so they skip the optimizer", () => {
    expect(
      studioCanvasImageUrl({
        url: GARMENT_FALLBACK,
        source: "template",
        mirror: false,
      }),
    ).toBe(GARMENT_FALLBACK);
    expect(
      studioCanvasImageUrl({
        url: STUDIO_SIDE_HOODIE,
        source: "side-view",
        mirror: false,
        plate: true,
      }),
    ).toBe(STUDIO_SIDE_HOODIE);
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

describe("backdropImageStyle", () => {
  it("fills the box with the crop rect", () => {
    const style = backdropImageStyle(SAMPLE_CROP, false);
    expect(style.left).toBe(`${(-SAMPLE_CROP.x / SAMPLE_CROP.width) * 100}%`);
    expect(style.width).toBe(`${100 / SAMPLE_CROP.width}%`);
    expect(style.objectFit).toBe("fill");
  });
});

describe("plateContainRect", () => {
  it("letterboxes a portrait sleeve crop inside the inset plate", () => {
    const box = plateContainRect(SAMPLE_CROP, 1, SLEEVE_PLATE_INSET);
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeCloseTo(SLEEVE_PLATE_INSET);
    expect(box.x + box.width).toBeLessThan(1);
    expect(box.width).toBeLessThan(box.height);
    expect(box.height).toBeCloseTo(1 - 2 * SLEEVE_PLATE_INSET);
  });

  it("contains a full square photo in the inset when there is no crop", () => {
    const box = plateContainRect(undefined, 1, SLEEVE_PLATE_INSET);
    expect(box.x).toBeCloseTo(SLEEVE_PLATE_INSET);
    expect(box.y).toBeCloseTo(SLEEVE_PLATE_INSET);
    expect(box.width).toBeCloseTo(1 - 2 * SLEEVE_PLATE_INSET);
    expect(box.height).toBeCloseTo(1 - 2 * SLEEVE_PLATE_INSET);
  });
});

describe("framedBackdropStyles", () => {
  it("pads a sleeve plate instead of filling the square", () => {
    const { frame, image } = framedBackdropStyles({
      crop: SAMPLE_CROP,
      mirror: false,
      plate: true,
    });
    const left = Number.parseFloat(frame.left);
    const width = Number.parseFloat(frame.width);
    expect(left).toBeGreaterThan(0);
    expect(left + width).toBeLessThan(100);
    expect(frame.overflow).toBe("hidden");
    expect(image.objectFit).toBe("fill");
  });

  it("leaves front/back on the full canvas", () => {
    const { frame, image } = framedBackdropStyles({
      mirror: false,
    });
    expect(frame.left).toBe("0%");
    expect(frame.width).toBe("100%");
    expect(image.objectFit).toBe("contain");
  });
});
