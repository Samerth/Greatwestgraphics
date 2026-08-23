import { describe, expect, it } from "vitest";
import { paginate, parsePage, queryHref, textMatchesQuery } from "./paged-list";

describe("parsePage", () => {
  it("defaults and rejects non-positive values", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("nope")).toBe(1);
    expect(parsePage("2.9")).toBe(2);
  });
});

describe("textMatchesQuery", () => {
  it("matches any haystack case-insensitively", () => {
    expect(textMatchesQuery(["T-Shirts", "ss:123"], "shirt")).toBe(true);
    expect(textMatchesQuery(["T-Shirts", "ss:123"], "SS:123")).toBe(true);
    expect(textMatchesQuery(["T-Shirts"], "hoodie")).toBe(false);
    expect(textMatchesQuery(["T-Shirts"], "  ")).toBe(true);
  });
});

describe("paginate", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("slices a page and clamps past the end", () => {
    expect(paginate(items, 2, 2)).toEqual({
      page: 2,
      pageCount: 3,
      pageSize: 2,
      total: 5,
      start: 3,
      end: 4,
      items: ["c", "d"],
    });
    expect(paginate(items, 99, 2).page).toBe(3);
    expect(paginate([], 4, 20)).toEqual({
      page: 1,
      pageCount: 1,
      pageSize: 20,
      total: 0,
      start: 0,
      end: 0,
      items: [],
    });
  });
});

describe("queryHref", () => {
  it("omits default query values", () => {
    expect(
      queryHref(
        "/admin/categories/mappings",
        { tab: "review", q: "", page: 1 },
        { tab: "review", page: "1" },
      ),
    ).toBe("/admin/categories/mappings");
    expect(
      queryHref(
        "/admin/categories/mappings",
        { tab: "mapped", q: "hoodie", page: 3 },
        { tab: "review", page: "1" },
      ),
    ).toBe("/admin/categories/mappings?tab=mapped&q=hoodie&page=3");
  });
});
