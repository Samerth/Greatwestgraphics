import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG_SWATCH_WINDOW,
  catalogSwatchWindow,
  nextCatalogSwatchStart,
  prevCatalogSwatchStart,
} from "./catalog-swatches";

describe("catalog swatch paging", () => {
  it("keeps a 17-colour style fully reachable in three windows of 7", () => {
    const first = catalogSwatchWindow(17, 0);
    expect(first).toMatchObject({
      start: 0,
      end: 7,
      remaining: 10,
      canPrev: false,
      canNext: true,
    });

    const secondStart = nextCatalogSwatchStart(17, first.start);
    expect(secondStart).toBe(7);
    const second = catalogSwatchWindow(17, secondStart);
    expect(second).toMatchObject({
      start: 7,
      end: 14,
      remaining: 3,
      canPrev: true,
      canNext: true,
    });

    const thirdStart = nextCatalogSwatchStart(17, second.start);
    expect(thirdStart).toBe(14);
    const third = catalogSwatchWindow(17, thirdStart);
    expect(third).toMatchObject({
      start: 14,
      end: 17,
      remaining: 0,
      canPrev: true,
      canNext: false,
    });
    expect(third.end - third.start).toBe(3);
    expect(CATALOG_SWATCH_WINDOW).toBe(7);
  });

  it("does not page when every colour already fits", () => {
    expect(catalogSwatchWindow(4, 0)).toMatchObject({
      start: 0,
      end: 4,
      remaining: 0,
      canPrev: false,
      canNext: false,
    });
    expect(nextCatalogSwatchStart(4, 0)).toBe(0);
    expect(prevCatalogSwatchStart(4, 0)).toBe(0);
  });

  it("steps back a full window from the last page", () => {
    expect(prevCatalogSwatchStart(17, 14)).toBe(7);
  });

  it("wires the shop and best-seller cards to the pager, not a dead +N leftover", () => {
    const grid = readFileSync(
      resolve(process.cwd(), "components/products/ProductsGrid.tsx"),
      "utf8",
    );
    const home = readFileSync(
      resolve(process.cwd(), "components/home/BestSellers.tsx"),
      "utf8",
    );
    expect(grid).toContain("CatalogColorSwatches");
    expect(grid).not.toContain("slice(0, 7)");
    expect(home).toContain("CatalogColorSwatches");
    expect(home).not.toContain("slice(0, 6)");
  });
});
