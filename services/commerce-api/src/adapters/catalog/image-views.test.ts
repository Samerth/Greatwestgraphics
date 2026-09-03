import { describe, expect, it } from "vitest";
import { classifyVendorImageRole, isModelShot, pickImageViews } from "./image-views.js";

describe("classifyVendorImageRole", () => {
  it("reads angle from the filename, not list order", () => {
    expect(classifyVendorImageRole("https://media.example.com/front.jpg")).toBe(
      "front",
    );
    expect(classifyVendorImageRole("https://media.example.com/back.jpg")).toBe(
      "back",
    );
    expect(classifyVendorImageRole("https://media.example.com/side.jpg")).toBe(
      "side",
    );
    expect(classifyVendorImageRole("https://cdn.example.com/17190_s_fm.jpg")).toBe(
      "side",
    );
  });

  it("leaves unlabeled SanMar catalog files unknown", () => {
    expect(
      classifyVendorImageRole(
        "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg",
      ),
    ).toBe("unknown");
  });
});

describe("isModelShot", () => {
  it("recognizes SanMar's on-model shorthand codes", () => {
    expect(isModelShot("https://media.example.com/108085_black_omf.jpg")).toBe(true);
    expect(isModelShot("https://media.example.com/108085_black_oms.jpg")).toBe(true);
    expect(isModelShot("https://media.example.com/108085_black_omb.jpg")).toBe(true);
  });

  it("recognizes the words model/lifestyle in a filename", () => {
    expect(isModelShot("https://media.example.com/108085-black-model.jpg")).toBe(true);
    expect(isModelShot("https://media.example.com/108085-black-on-model.jpg")).toBe(true);
    expect(isModelShot("https://media.example.com/108085-black-lifestyle.jpg")).toBe(true);
  });

  it("does not flag a plain flat/ghost product shot", () => {
    expect(isModelShot("https://media.example.com/108085_black_front.jpg")).toBe(false);
    expect(
      isModelShot("https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg"),
    ).toBe(false);
  });
});

describe("pickImageViews", () => {
  it("does not call the second URL a side shot when the names say otherwise", () => {
    // SanMar Canada often answers a style-level media request with every
    // colour and angle, newline-separated. The published fixture order is
    // front, back, side — unique[1] is the back, not a sleeve.
    expect(
      pickImageViews([
        "https://media.example.com/front.jpg",
        "https://media.example.com/back.jpg",
        "https://media.example.com/side.jpg",
      ]),
    ).toEqual({
      imageFront: "https://media.example.com/front.jpg",
      imageSide: "https://media.example.com/side.jpg",
      imageBack: "https://media.example.com/back.jpg",
    });
  });

  it("does not invent a sleeve from unlabeled list order", () => {
    expect(
      pickImageViews([
        "https://media.example.com/a.jpg",
        "https://media.example.com/b.jpg",
        "https://media.example.com/c.jpg",
      ]),
    ).toEqual({
      imageFront: "https://media.example.com/a.jpg",
      imageSide: undefined,
      imageBack: "https://media.example.com/b.jpg",
    });
  });

  it("drops blanks and duplicate addresses", () => {
    expect(
      pickImageViews([
        "  https://media.example.com/front.jpg  ",
        "https://media.example.com/front.jpg",
        "",
        "https://media.example.com/side.jpg",
      ]),
    ).toEqual({
      imageFront: "https://media.example.com/front.jpg",
      imageSide: "https://media.example.com/side.jpg",
      imageBack: undefined,
    });
  });
});
