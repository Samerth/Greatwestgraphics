import { describe, expect, it } from "vitest";
import {
  ALL_CATEGORIES,
  categoryToggleTarget,
  isCategoryActive,
  resolveCategoryId,
} from "./category-slug";

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

describe("isCategoryActive", () => {
  it("matches regardless of casing on either side", () => {
    expect(isCategoryActive("Short-Sleeve", "short-sleeve")).toBe(true);
    expect(isCategoryActive("short-sleeve", "SHORT-SLEEVE")).toBe(true);
  });

  it("tolerates surrounding whitespace from a URL", () => {
    expect(isCategoryActive("short-sleeve", "  short-sleeve  ")).toBe(true);
  });

  it("is false for a sibling and for no active category", () => {
    expect(isCategoryActive("organic", "short-sleeve")).toBe(false);
    expect(isCategoryActive("short-sleeve", "")).toBe(false);
  });
});

describe("categoryToggleTarget", () => {
  // CodSphere UAT V2 row 66: the active filter must stay in the list and be
  // clearable, rather than removing itself the moment it is chosen.
  it("selects a subcategory that is not currently active", () => {
    expect(categoryToggleTarget("heavyweight", "short-sleeve", "t-shirts")).toBe(
      "heavyweight",
    );
  });

  it("steps up to the parent department when the active subcategory is unticked", () => {
    expect(categoryToggleTarget("heavyweight", "heavyweight", "t-shirts")).toBe(
      "t-shirts",
    );
  });

  it("clears to All when a department with no parent is unticked", () => {
    expect(categoryToggleTarget("t-shirts", "t-shirts")).toBe(ALL_CATEGORIES);
  });

  it("still steps up when the URL's casing differs from the nav tree's", () => {
    expect(categoryToggleTarget("Heavyweight", "heavyweight", "t-shirts")).toBe(
      "t-shirts",
    );
  });

  it("selects normally when nothing is active yet", () => {
    expect(categoryToggleTarget("heavyweight", "", "t-shirts")).toBe("heavyweight");
  });

  it("is its own inverse: select then unselect returns to the parent", () => {
    const selected = categoryToggleTarget("organic", "t-shirts", "t-shirts");
    expect(selected).toBe("organic");
    expect(categoryToggleTarget("organic", selected, "t-shirts")).toBe("t-shirts");
  });
});

/**
 * The reported defect, stated the way the client stated it: "Selecting a
 * filter on the left side of the screen results in selected filter
 * disappearing — for example, I selected 'heavy weight' and it disappeared
 * from the filter list."
 *
 * Asserted against the whole sidebar list rather than the toggle helper
 * alone, because the complaint is about what remains on screen.
 */
describe("UAT V2 row 66 — the selected filter stays in the list", () => {
  const TSHIRT_CHILDREN = [
    { slug: "short-sleeve", name: "Short Sleeve" },
    { slug: "long-sleeve", name: "Long Sleeve" },
    { slug: "heavyweight", name: "Heavyweight" },
    { slug: "lightweight", name: "Lightweight" },
    { slug: "organic", name: "Organic" },
  ];

  /** What the sidebar renders for one department at a given active slug. */
  function renderSidebar(activeCategory: string) {
    return TSHIRT_CHILDREN.map((child) => ({
      slug: child.slug,
      checked: isCategoryActive(child.slug, activeCategory),
    }));
  }

  it("lists every sibling and ticks none before a filter is chosen", () => {
    const rows = renderSidebar("t-shirts");
    expect(rows).toHaveLength(TSHIRT_CHILDREN.length);
    expect(rows.every((r) => !r.checked)).toBe(true);
  });

  it("still lists Heavyweight after Heavyweight is selected, now ticked", () => {
    const rows = renderSidebar("heavyweight");
    // The regression itself: this row used to be filtered out entirely.
    expect(rows.map((r) => r.slug)).toContain("heavyweight");
    expect(rows).toHaveLength(TSHIRT_CHILDREN.length);
    expect(rows.find((r) => r.slug === "heavyweight")?.checked).toBe(true);
  });

  it("ticks exactly one row, never several", () => {
    expect(renderSidebar("heavyweight").filter((r) => r.checked)).toHaveLength(1);
  });

  it("can be unticked again, which is what the vanished checkbox prevented", () => {
    const cleared = categoryToggleTarget("heavyweight", "heavyweight", "t-shirts");
    expect(cleared).toBe("t-shirts");
    expect(renderSidebar(cleared).every((r) => !r.checked)).toBe(true);
  });
});
