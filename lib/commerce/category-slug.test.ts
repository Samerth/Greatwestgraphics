import { describe, expect, it } from "vitest";
import { resolveCategoryId, visibleChildCategories } from "./category-slug";

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

describe("visibleChildCategories", () => {
  const children = [
    { slug: "short-sleeve" },
    { slug: "Long-Sleeve" },
    { slug: "organic" },
  ];

  it("drops the active subcategory so it isn't shown as a redundant filter", () => {
    expect(visibleChildCategories(children, "short-sleeve")).toEqual([
      { slug: "Long-Sleeve" },
      { slug: "organic" },
    ]);
  });

  it("matches regardless of casing", () => {
    expect(visibleChildCategories(children, "LONG-SLEEVE")).toEqual([
      { slug: "short-sleeve" },
      { slug: "organic" },
    ]);
  });

  it("keeps every child when the active slug isn't one of them (e.g. the parent department)", () => {
    expect(visibleChildCategories(children, "t-shirts")).toEqual(children);
  });

  it("keeps every child when there is no active category", () => {
    expect(visibleChildCategories(children, "")).toEqual(children);
  });
});
