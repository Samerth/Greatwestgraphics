import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "./catalog";
import {
  BEST_SELLERS_OTHER,
  BEST_SELLERS_SLUG,
  bestSellerAnchor,
  bestSellerSectionHeading,
  bestSellerViewAllHref,
  groupBestSellersByCategory,
} from "./best-sellers";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = stripComments(read("app/(shop)/best-sellers/page.tsx"));
const sections = stripComments(
  read("components/products/BestSellersSections.tsx"),
);
const header = stripComments(read("components/layout/Header.tsx"));

const CATEGORIES: StorefrontCategory[] = [
  { id: "1", name: "Best Sellers", slug: BEST_SELLERS_SLUG, parentId: null },
  { id: "2", name: "T-Shirts", slug: "t-shirts", parentId: null },
  { id: "3", name: "Short Sleeve Shirts", slug: "short-sleeve", parentId: "2" },
  { id: "4", name: "Long Sleeve Shirts", slug: "long-sleeve", parentId: "2" },
  { id: "5", name: "Hoodies", slug: "hoodies", parentId: null },
  // As the live taxonomy actually names them: a qualifier under a department.
  { id: "6", name: "Women's", slug: "women-s", parentId: "2" },
  { id: "7", name: "Performance", slug: "performance", parentId: "2" },
];

function product(
  id: string,
  categorySlugs: string[],
): StorefrontCatalogProduct {
  return {
    id,
    slug: `slug-${id}`,
    name: `Product ${id}`,
    brandName: "Test Brand",
    styleName: id,
    title: null,
    colorName: "Black",
    colorwayCount: 1,
    colorSwatches: [],
    sizeRange: "S - XL",
    categorySlugs,
    isBestSeller: true,
    isHat: false,
    retailMinor: 2000,
    costMinor: 800,
    mapPriceMinor: null,
    isDark: true,
    available: true,
    imageUrl: null,
    sideImageUrl: null,
    backImageUrl: null,
    priceFrom: "from $8.00",
  } as StorefrontCatalogProduct;
}

/**
 * CodSphere UAT V2 row 68, and Pavin verbally on 11 September: Best Sellers
 * should follow the Coastal Reign page, which groups by category.
 */
describe("best sellers are grouped by category", () => {
  it("puts each product under its most specific category", () => {
    // A tee is filed under both T-Shirts and Short Sleeve Shirts. The
    // reference headings are the narrower one; grouping by the parent would
    // collapse four useful sections into one.
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG, "t-shirts", "short-sleeve"])],
      CATEGORIES,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.slug).toBe("short-sleeve");
    expect(result[0]!.name).toBe("Short Sleeve Shirts");
  });

  it("names a qualifier-only subcategory with its department", () => {
    // The live page read "Best Sellers in Women's" and "Best Sellers in
    // Performance" (15 Sep) - women's what? Same rule as the brand pages.
    const result = groupBestSellersByCategory(
      [
        product("w", [BEST_SELLERS_SLUG, "t-shirts", "women-s"]),
        product("p", [BEST_SELLERS_SLUG, "t-shirts", "performance"]),
      ],
      CATEGORIES,
    );
    expect(result.map((section) => section.name)).toEqual([
      "Women's T-Shirts",
      "Performance T-Shirts",
    ]);
    expect(bestSellerSectionHeading(result[0]!)).toBe("Best Sellers in Women's T-Shirts");
  });

  it("never groups anything under Best Sellers itself", () => {
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG, "hoodies"])],
      CATEGORIES,
    );
    expect(result.map((section) => section.slug)).not.toContain(
      BEST_SELLERS_SLUG,
    );
  });

  it("shows a product once, not once per category it belongs to", () => {
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG, "t-shirts", "short-sleeve"])],
      CATEGORIES,
    );
    const total = result.reduce(
      (sum, section) => sum + section.products.length,
      0,
    );
    expect(total).toBe(1);
  });

  it("falls back to a top-level category when there is no subcategory", () => {
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG, "hoodies"])],
      CATEGORIES,
    );
    expect(result[0]!.slug).toBe("hoodies");
  });

  it("keeps a product with no other category rather than dropping it", () => {
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG])],
      CATEGORIES,
    );
    expect(result[0]!.slug).toBe(BEST_SELLERS_OTHER.slug);
    expect(result[0]!.products).toHaveLength(1);
  });

  it("ignores a category slug the taxonomy does not know", () => {
    // Stale slugs on a product must not invent an unnamed section.
    const result = groupBestSellersByCategory(
      [product("a", [BEST_SELLERS_SLUG, "deleted-category"])],
      CATEGORIES,
    );
    expect(result[0]!.slug).toBe(BEST_SELLERS_OTHER.slug);
  });

  it("orders sections by the published taxonomy, not by product count", () => {
    // Otherwise the page reshuffles itself every time staff tick a different
    // product as a best seller.
    const result = groupBestSellersByCategory(
      [
        product("a", [BEST_SELLERS_SLUG, "hoodies"]),
        product("b", [BEST_SELLERS_SLUG, "short-sleeve"]),
        product("c", [BEST_SELLERS_SLUG, "short-sleeve"]),
      ],
      CATEGORIES,
    );
    expect(result.map((section) => section.slug)).toEqual([
      "short-sleeve",
      "hoodies",
    ]);
  });

  it("always puts the catch-all last", () => {
    const result = groupBestSellersByCategory(
      [
        product("a", [BEST_SELLERS_SLUG]),
        product("b", [BEST_SELLERS_SLUG, "hoodies"]),
      ],
      CATEGORIES,
    );
    expect(result[result.length - 1]!.slug).toBe(BEST_SELLERS_OTHER.slug);
  });

  it("returns nothing at all when no product is a best seller", () => {
    expect(groupBestSellersByCategory([], CATEGORIES)).toEqual([]);
  });
});

describe("section headings and links", () => {
  it("reads 'Best Sellers in <category>', as the reference does", () => {
    expect(
      bestSellerSectionHeading({ name: "Hoodies", slug: "hoodies" }),
    ).toBe("Best Sellers in Hoodies");
  });

  it("does not prefix the catch-all, which is not a department", () => {
    expect(bestSellerSectionHeading(BEST_SELLERS_OTHER)).toBe(
      "More Best Sellers",
    );
  });

  it("points View all at the category", () => {
    expect(bestSellerViewAllHref({ slug: "hoodies" })).toBe(
      "/products?category=hoodies",
    );
  });

  it("sends the catch-all somewhere real rather than a dead filter", () => {
    expect(bestSellerViewAllHref(BEST_SELLERS_OTHER)).toBe("/products");
  });

  it("gives every section a unique anchor for the sidebar", () => {
    expect(bestSellerAnchor("short-sleeve")).toBe("best-in-short-sleeve");
  });
});

describe("the page itself", () => {
  it("is curated through the existing Best Sellers category", () => {
    // Row 68 asks for it to be editable in admin. It already is — assigning
    // a product to the category is the whole job, and there is no second
    // list to fall out of step.
    expect(page).toContain("categorySlug: BEST_SELLERS_SLUG");
  });

  it("renders a jump-to sidebar of the categories present", () => {
    expect(page).toContain("Jump to");
    expect(page).toContain("section.anchor");
  });

  it("gives each category its own scrollable row", () => {
    expect(sections).toContain('data-best-sellers="row"');
    expect(sections).toContain("View all");
  });

  it("prices cards from the shared catalogue helper, not its own maths", () => {
    // Row 53 was explicit that no separate pricing logic be introduced.
    expect(sections).toContain("catalogCardPricing");
    expect(sections).not.toMatch(/priceStorefrontQuote|calculateQuote/);
  });

  it("hides the scroll arrows when there is nowhere to scroll", () => {
    expect(sections).toContain("hasOverflow");
  });

  it("says what to do when nothing has been marked a best seller", () => {
    expect(sections).toMatch(/Assign products to the Best Sellers/);
  });
});

describe("the navigation points at the page", () => {
  it("links Best Sellers to its own page, not a filtered grid", () => {
    expect(header).toContain('href="/best-sellers"');
    expect(header).not.toContain("/products?category=best-sellers");
  });
});
