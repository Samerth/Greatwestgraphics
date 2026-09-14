import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { brandSlug, type BrandCategory, type BrandOverview } from "@gwg/contracts";

import {
  brandBlurb,
  brandCategoryLabel,
  brandDepartments,
  brandHeading,
  brandListingHref,
  brandPageHref,
  styleCountLabel,
} from "./brand-page";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * UAT V2 row 62, second pass (15 Sep): "it categorizes correctly but it says
 * all products when clicked on a brand, see how coastal reign does it".
 *
 * A brand now has a page of its own, and the listing behind it knows which
 * brand it is showing. These pin the page's logic; the API side is covered
 * by the endpoint being read live in the page.
 */

const category = (
  overrides: Partial<BrandCategory> & { id: string; name: string; slug: string },
): BrandCategory => ({
  parentId: null,
  styleCount: 1,
  imageUrl: null,
  ...overrides,
});

// Gildan as the catalogue reported it on 15 Sep, trimmed.
const tshirts = category({ id: "t", name: "T-Shirts", slug: "t-shirts", styleCount: 43 });
const hoodies = category({ id: "h", name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts", styleCount: 18 });
const polos = category({ id: "p", name: "Polos", slug: "polos", styleCount: 4 });
const gildan: BrandOverview = {
  name: "Gildan",
  slug: "gildan",
  logoUrl: null,
  styleCount: 73,
  categories: [
    category({ id: "bs", name: "Best Sellers", slug: "best-sellers", styleCount: 5 }),
    polos,
    category({ id: "pw", name: "Women's", slug: "polos-women-s", parentId: "p", styleCount: 1 }),
    tshirts,
    category({ id: "ss", name: "Short Sleeve", slug: "short-sleeve", parentId: "t", styleCount: 33 }),
    category({ id: "ls", name: "Long Sleeve", slug: "long-sleeve", parentId: "t", styleCount: 9 }),
    category({ id: "y", name: "Youth", slug: "youth", parentId: "t", styleCount: 9 }),
    hoodies,
    category({ id: "fl", name: "Fleece", slug: "fleece", parentId: "h", styleCount: 17 }),
    category({ id: "cr", name: "Crewnecks", slug: "crewnecks", parentId: "h", styleCount: 5 }),
  ],
};

describe("brand slugs", () => {
  it("turn a vendor's brand name into a URL segment", () => {
    expect(brandSlug("Gildan")).toBe("gildan");
    expect(brandSlug("Bella+Canvas")).toBe("bella-canvas");
    expect(brandSlug("The North Face")).toBe("the-north-face");
    expect(brandSlug("ATC Pro Team")).toBe("atc-pro-team");
    expect(brandSlug("  Nike ")).toBe("nike");
  });

  it("build the page and listing links from the same brand", () => {
    expect(brandPageHref({ slug: "bella-canvas" })).toBe("/brands/bella-canvas");
    // The listing filter keeps the vendor's exact spelling, encoded.
    expect(brandListingHref({ name: "Bella+Canvas" })).toBe("/products?brand=Bella%2BCanvas");
    expect(brandListingHref({ name: "Gildan" }, "long-sleeve")).toBe(
      "/products?brand=Gildan&category=long-sleeve",
    );
  });
});

describe("a brand's departments", () => {
  const departments = brandDepartments(gildan.categories);

  it("are the top-level categories, largest first", () => {
    expect(departments.map((d) => d.name)).toEqual([
      "T-Shirts",
      "Hoodies & Sweatshirts",
      "Polos",
    ]);
  });

  it("carry their own non-empty subcategories, largest first", () => {
    expect(departments[0]!.children.map((c) => `${c.name} ${c.styleCount}`)).toEqual([
      "Short Sleeve 33",
      "Long Sleeve 9",
      "Youth 9",
    ]);
    expect(departments[2]!.children.map((c) => c.name)).toEqual(["Women's"]);
  });

  it("do not include Best Sellers as a tile", () => {
    // It feeds the popular row on the brand page instead.
    expect(departments.some((d) => d.slug === "best-sellers")).toBe(false);
  });
});

describe("what a brand's category is called", () => {
  const ls = gildan.categories.find((c) => c.slug === "long-sleeve")!;
  const youth = gildan.categories.find((c) => c.slug === "youth")!;
  const womens = gildan.categories.find((c) => c.slug === "polos-women-s")!;
  const crewnecks = gildan.categories.find((c) => c.slug === "crewnecks")!;

  it("names a department plainly", () => {
    expect(brandCategoryLabel(gildan, tshirts)).toBe("Gildan T-Shirts");
  });

  it("qualifies a subcategory with its department when the name needs it", () => {
    // "Gildan Long Sleeve" was the heading on the first pass; it does not say
    // long sleeve what.
    expect(brandCategoryLabel(gildan, ls, tshirts)).toBe("Gildan Long Sleeve T-Shirts");
    expect(brandCategoryLabel(gildan, youth, tshirts)).toBe("Gildan Youth T-Shirts");
    expect(brandCategoryLabel(gildan, womens, polos)).toBe("Gildan Women's Polos");
  });

  it("leaves a subcategory alone when it is already a product type", () => {
    expect(brandCategoryLabel(gildan, crewnecks, hoodies)).toBe("Gildan Crewnecks");
    expect(
      brandCategoryLabel(
        { name: "Nike" },
        { name: "Teamwear", parentId: "a" },
        { name: "Athletic Wear" },
      ),
    ).toBe("Nike Teamwear");
  });

  it("titles the page and counts styles in words", () => {
    expect(brandHeading(gildan)).toBe("Custom Gildan");
    expect(styleCountLabel(1)).toBe("1 style");
    expect(styleCountLabel(73)).toBe("73 styles");
    expect(brandBlurb(gildan)).toBe(
      "73 styles across T-Shirts, Hoodies & Sweatshirts, Polos, screen printed or embroidered in Vancouver.",
    );
  });
});

describe("the pages are wired", () => {
  const brandPage = stripComments(read("app/(shop)/brands/[slug]/page.tsx"));
  const index = stripComments(read("app/(shop)/brands/page.tsx"));
  const listing = stripComments(read("app/(shop)/products/page.tsx"));
  const grid = stripComments(read("components/products/ProductsGrid.tsx"));

  it("gives a brand its own page with tiles, a popular row and a view-all", () => {
    expect(brandPage).toContain("BrandDepartmentTiles");
    expect(brandPage).toContain("ProductCarouselRow");
    expect(brandPage).toContain("brandListingHref(brand)");
    expect(brandPage).toContain("notFound()");
    // An outage is not a missing brand.
    expect(brandPage).toMatch(/kind === "unavailable"[\s\S]*?CatalogUnavailable/);
  });

  it("has an index every brand links back to", () => {
    expect(index).toContain("loadStorefrontBrandIndex");
    expect(index).toContain("brandPageHref(brand)");
  });

  it("heads a single-brand listing by the brand, not as the whole catalogue", () => {
    expect(listing).toContain("singleBrand(brand)");
    expect(listing).toContain("brandHeading(brandScope)");
    expect(listing).toContain("brandCategoryLabel(brandScope, activeCategory, activeParent)");
    expect(listing).toContain("brandScope={brandScope}");
    // Breadcrumb: Home / Brands / Gildan / All Gildan.
    expect(listing).toMatch(/href=\{brandPageHref\(brandScope\)\}/);
    expect(listing).toContain("`All ${brandScope.name}`");
  });

  it("narrows the sidebar to the brand's own categories, with counts", () => {
    expect(grid).toMatch(/brandScope\s*\?\s*\[\.\.\.brandScope\.categories\]\.sort/);
    expect(grid).toContain("`All ${brandScope.name} (${brandScope.styleCount})`");
    expect(grid).toContain("`${category.name} (${count})`");
    expect(grid).toContain("`${brandScope.name} categories`");
  });
});
