import { describe, expect, it } from "vitest";
import {
  categoryListHref,
  groupMappings,
  mappedRows,
  mappingListHref,
  mappingMatchesQuery,
  parseMappingTab,
  unmappedRows,
} from "./mapping-list";

describe("parseMappingTab", () => {
  it("defaults to review", () => {
    expect(parseMappingTab(undefined)).toBe("review");
    expect(parseMappingTab("mapped")).toBe("mapped");
    expect(parseMappingTab("other")).toBe("review");
  });
});

describe("mappingListHref", () => {
  it("keeps the current tab, query, and page", () => {
    expect(mappingListHref({})).toBe("/admin/categories/mappings");
    expect(mappingListHref({ tab: "mapped", q: "polo", page: 4 })).toBe(
      "/admin/categories/mappings?tab=mapped&q=polo&page=4",
    );
  });
});

describe("categoryListHref", () => {
  it("omits page 1", () => {
    expect(categoryListHref({ q: "tee", page: 1 })).toBe(
      "/admin/categories?q=tee",
    );
  });
});

describe("groupMappings / rows", () => {
  it("groups vendor keys and builds review/mapped rows", () => {
    const { mapsByKey, labelByKey } = groupMappings([
      {
        ssCategoryKey: "ss:tees",
        ssCategoryLabel: "T-Shirts",
        categoryId: "cat-1",
      },
      {
        ssCategoryKey: "ss:tees",
        ssCategoryLabel: "T-Shirts",
        categoryId: "cat-2",
      },
    ]);
    expect(mapsByKey.get("ss:tees")).toEqual(["cat-1", "cat-2"]);
    expect(labelByKey.get("ss:tees")).toBe("T-Shirts");

    const review = unmappedRows(
      [{ ssCategoryKey: "ss:hats", ssCategoryLabel: "Hats", styleCount: 12 }],
      mapsByKey,
    );
    expect(review).toEqual([
      { key: "ss:hats", label: "Hats", styleCount: 12, categoryIds: [] },
    ]);
    expect(mappedRows(mapsByKey, labelByKey)[0]).toEqual({
      key: "ss:tees",
      label: "T-Shirts",
      styleCount: 0,
      categoryIds: ["cat-1", "cat-2"],
    });
    expect(mappingMatchesQuery(review[0]!, "HAT")).toBe(true);
  });
});
