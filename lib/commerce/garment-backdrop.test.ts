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
  isStudioSideRepresentation,
  namedVendorView,
  plateContainRect,
  proxyExternalImageUrl,
  sleeveGuideRect,
  studioBackdropFallbackUrl,
  studioCanvasImageUrl,
  studioSideViewTemplate,
  usableSidePhoto,
  type PhotoCrop,
} from "./garment-backdrop";
import { STUDIO_PRINT_AREAS } from "./studio-placement";

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

describe("isStudioSideRepresentation", () => {
  it("is true only for photorealistic side plates", () => {
    expect(
      isStudioSideRepresentation(garmentBackdropForSide("left", PHOTOS)),
    ).toBe(false);
    expect(
      isStudioSideRepresentation(
        garmentBackdropForSide("left", { ...PHOTOS, colorSideImageUrl: null }),
      ),
    ).toBe(true);
    expect(
      isStudioSideRepresentation(garmentBackdropForSide("front", PHOTOS)),
    ).toBe(false);
  });
});

describe("studioSideViewTemplate", () => {
  it("picks the hoodie plate for fleece and the tee plate otherwise", () => {
    expect(studioSideViewTemplate("Coastal Hoodie")).toBe(STUDIO_SIDE_HOODIE);
    expect(studioSideViewTemplate("Crew Fleece")).toBe(STUDIO_SIDE_HOODIE);
    expect(studioSideViewTemplate("Ring-spun Tee")).toBe(STUDIO_SIDE_TEE);
    expect(studioSideViewTemplate(null)).toBe(STUDIO_SIDE_TEE);
  });

  it("reads the manufacturer title when the style code is not a garment kind", () => {
    expect(
      studioSideViewTemplate("A2009", "Men's Ultimate365 Elevated Hoodie"),
    ).toBe(STUDIO_SIDE_HOODIE);
    expect(studioSideViewTemplate("A2009")).toBe(STUDIO_SIDE_TEE);
    expect(
      garmentBackdropForSide("left", {
        ...PHOTOS,
        colorSideImageUrl: null,
        styleName: "A2009",
        styleTitle: "Men's Ultimate365 Elevated Hoodie",
      }),
    ).toMatchObject({ url: STUDIO_SIDE_HOODIE, source: "side-view" });
  });
});

describe("studioBackdropFallbackUrl", () => {
  it("falls back from a vendor sleeve photo to the local plate", () => {
    expect(
      studioBackdropFallbackUrl(
        { url: PHOTOS.colorSideImageUrl, source: "photo", plate: true },
        { styleName: "A2009", styleTitle: "Men's Ultimate365 Elevated Hoodie" },
      ),
    ).toBe(STUDIO_SIDE_HOODIE);
  });

  it("falls back from a chest photo to the generic tee", () => {
    expect(
      studioBackdropFallbackUrl({
        url: PHOTOS.colorFrontImageUrl,
        source: "photo",
      }),
    ).toBe(GARMENT_FALLBACK);
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

describe("proxyExternalImageUrl", () => {
  it("proxies external CDN URLs through Next.js image optimizer", () => {
    const cdn = "https://cdn.ssactivewear.com/Images/Color/17190_f_fm.jpg";
    expect(proxyExternalImageUrl(cdn)).toBe(
      `/_next/image?url=${encodeURIComponent(cdn)}&w=640&q=75`,
    );
  });

  it("leaves local /images paths unchanged", () => {
    expect(proxyExternalImageUrl("/images/t-shirt.png")).toBe(
      "/images/t-shirt.png",
    );
    expect(proxyExternalImageUrl("/images/studio/side-tee.png")).toBe(
      "/images/studio/side-tee.png",
    );
  });

  it("leaves data: URLs unchanged", () => {
    const dataUrl = "data:image/svg+xml;charset=utf-8,%3Csvg%20...";
    expect(proxyExternalImageUrl(dataUrl)).toBe(dataUrl);
  });

  it("leaves blob: URLs unchanged", () => {
    const blobUrl = "blob:https://example.com/abc123";
    expect(proxyExternalImageUrl(blobUrl)).toBe(blobUrl);
  });

  it("returns null for null/undefined input", () => {
    expect(proxyExternalImageUrl(null)).toBeNull();
    expect(proxyExternalImageUrl(undefined)).toBeNull();
  });
});

describe("sleeveGuideRect", () => {
  it("gives the tee and hoodie templates their own, different boxes", () => {
    const tee = sleeveGuideRect({ url: STUDIO_SIDE_TEE, source: "side-view" }, "left");
    const hoodie = sleeveGuideRect({ url: STUDIO_SIDE_HOODIE, source: "side-view" }, "left");
    // The client's own point: a short-sleeve tee and a long-sleeve hoodie
    // do not have their sleeve in the same place — one shared box was
    // never going to be right for both.
    expect(tee).not.toEqual(hoodie);
    // Both boxes must be real, sane rectangles — comfortably inside the
    // canvas, not a rounding accident that happens to pass every other
    // assertion.
    for (const rect of [tee, hoodie]) {
      expect(rect.x).toBeGreaterThan(0);
      expect(rect.y).toBeGreaterThan(0);
      expect(rect.x + rect.width).toBeLessThan(1);
      expect(rect.y + rect.height).toBeLessThan(1);
    }
  });

  it("mirrors the template box horizontally for the right sleeve", () => {
    const left = sleeveGuideRect({ url: STUDIO_SIDE_TEE, source: "side-view" }, "left");
    const right = sleeveGuideRect({ url: STUDIO_SIDE_TEE, source: "side-view" }, "right");
    expect(right.width).toBe(left.width);
    expect(right.height).toBe(left.height);
    expect(right.y).toBe(left.y);
    // Same distance from its own edge of the canvas as the left box is
    // from its edge — a true mirror around the centre line, not just "a
    // different number."
    expect(right.x).toBeCloseTo(1 - left.x - left.width, 10);
  });

  it("falls back to the tee box for an unrecognised template URL", () => {
    const unknown = sleeveGuideRect({ url: "/images/studio/side-unknown.png", source: "side-view" }, "left");
    const tee = sleeveGuideRect({ url: STUDIO_SIDE_TEE, source: "side-view" }, "left");
    expect(unknown).toEqual(tee);
  });

  it("widens the box for a real vendor photo instead of using the tight template box", () => {
    // There is no per-photo data to calibrate a tight box against a real
    // vendor photo, so this is deliberately generous rather than
    // confidently precise (client decision, same reasoning as the chest
    // position fix: widen rather than force a small fixed size).
    const real = sleeveGuideRect({ url: "https://cdn.example.com/side.jpg", source: "photo" }, "left");
    const oldTightBox = STUDIO_PRINT_AREAS.left;
    expect(real.width).toBeGreaterThan(oldTightBox.width);
    expect(real.height).toBeGreaterThan(oldTightBox.height);
  });

  it("mirrors the widened real-photo box for the right sleeve too", () => {
    const left = sleeveGuideRect({ url: "https://cdn.example.com/side.jpg", source: "photo" }, "left");
    const right = sleeveGuideRect({ url: "https://cdn.example.com/side.jpg", source: "photo" }, "right");
    expect(right.width).toBe(left.width);
    expect(right.height).toBe(left.height);
  });
});
