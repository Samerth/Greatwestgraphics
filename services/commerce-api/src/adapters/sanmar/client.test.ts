import { describe, expect, it } from "vitest";
import { parseSellableProductId } from "./client.js";

describe("parseSellableProductId", () => {
  it("parses style, color, size", () => {
    expect(parseSellableProductId("NF0A529K(TNF Black,S,)")).toEqual({
      styleId: "NF0A529K",
      colorName: "TNF Black",
      sizeName: "S",
      discontinued: false,
    });
  });

  it("flags discontinued codes", () => {
    expect(parseSellableProductId("NF0A529K(TNF Black,M,C)")?.discontinued).toBe(
      true,
    );
  });
});
