import { describe, expect, it } from "vitest";
import { resolveCategoryId } from "./category-slug";

describe("resolveCategoryId", () => {
  const categories = [
    { id: "tee", slug: "t-shirts" },
    { id: "hat", slug: "Hats" },
  ];

  it("matches a slug regardless of casing", () => {
    expect(resolveCategoryId(categories, "T-Shirts")).toBe("tee");
    expect(resolveCategoryId(categories, "hats")).toBe("hat");
  });

  it("returns undefined for an unknown slug instead of falling through", () => {
    expect(resolveCategoryId(categories, "bags")).toBeUndefined();
    expect(resolveCategoryId(categories, "")).toBeUndefined();
  });
});
