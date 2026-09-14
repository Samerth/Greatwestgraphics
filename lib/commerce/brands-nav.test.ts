import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Comments name the old behaviour on purpose, so they must not be searched. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const header = stripComments(read("components/layout/Header.tsx"));
const layout = stripComments(read("app/(shop)/layout.tsx"));
const catalog = stripComments(read("lib/commerce/catalog.ts"));

/**
 * CodSphere UAT V2 row 62: "Brands should be a dropdown category."
 *
 * Row 2 reported Gildan as "missing and not filtering properly", but Gildan
 * tests correctly through search, the admin catalogue and the brand filter.
 * What did not exist was a Brands menu — the header's Brands link went to the
 * unfiltered catalogue, so a shopper looking for a brand landed on everything
 * and concluded the brand was absent. Row 62 is the real defect behind row 2.
 */
describe("Brands menu (row 62, closing row 2)", () => {
  it("no longer sends Brands straight to the unfiltered catalogue", () => {
    // The fallback link survives for the outage case, but the primary path
    // must be a dropdown trigger.
    expect(header).toContain("brandsOpen");
    expect(header).toContain("openBrandsViaClick");
    expect(header).toMatch(/label="Brands"/);
  });

  it("links each brand to its own page, not to the catalogue with a box ticked", () => {
    // Second pass, 15 Sep: a brand link used to open /products?brand=<name>,
    // which announced itself as "Shop All Products". Every brand link now
    // opens /brands/<slug>, and "View All Brands" opens the index.
    expect(header).not.toContain("/products?brand=");
    expect(header.match(/href=\{brandPageHref\(brand\)\}/g)?.length).toBe(3);
    expect(header.match(/href="\/brands"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("opens on hover and on click, like every other nav trigger", () => {
    expect(header).toContain("onMouseEnter={openBrands}");
    expect(header).toContain("onToggle={openBrandsViaClick}");
    expect(header).toContain("scheduleBrandsClose");
  });

  it("closes the other menus when it opens, so only one is ever shown", () => {
    // openDept and openShop must both close it, and it must close them.
    expect(header.match(/closeBrands\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    // Line-ending agnostic: this repo checks out CRLF on Windows.
    expect(header).toMatch(/closeShop\(\);\s*closeBrands\(\);/);
  });

  it("closes on an outside click or Escape along with the other menus", () => {
    expect(header).toMatch(/setBrandsOpen\(false\);[\s\S]{0,200}setAccountOpen\(false\)/);
  });
});

/**
 * The menu is only useful if every name in it leads somewhere. An earlier
 * hand-written seed list (SHOP_BRAND_SEED) carried names with no catalogue
 * behind them; a click on one of those reproduces row 2 exactly.
 */
describe("Brands menu is driven by the live catalogue", () => {
  it("loads brands from the catalogue rather than a hardcoded list", () => {
    expect(catalog).toContain("export async function loadStorefrontBrands");
    expect(catalog).toContain("listBrands()");
    expect(header).not.toContain("SHOP_BRAND_SEED");
  });

  it("passes the live brands into the header", () => {
    // Summaries rather than bare names since the second pass: the menu links
    // to /brands/<slug> and the featured rail shows the vendor's logo.
    expect(layout).toContain("loadStorefrontBrandIndex()");
    expect(layout).toContain("brands={brands}");
    expect(header).toContain("brands?: BrandSummary[]");
  });

  it("shows the vendor's logo on a featured tile when the catalogue has one", () => {
    // "logo is here but not in the dropdown?" - the brand page and the
    // menu now read the same brandImageUrl (15 Sep).
    expect(header).toMatch(/brand\.logoUrl \? \([\s\S]{0,400}?<CatalogImage[\s\S]{0,200}?src=\{brand\.logoUrl\}/);
    // And the name is always there beneath it, logo or not.
    expect(header).toMatch(/<span>\{brand\.name\}<\/span>/);
  });

  it("degrades to a plain link when no brands are available", () => {
    // A catalogue outage must not leave a dropdown that opens onto nothing.
    expect(header).toContain("HAS_BRANDS");
    expect(catalog).toContain("BRANDS_UNAVAILABLE");
  });

  it("only features a brand the catalogue actually carries", () => {
    expect(header).toContain("FEATURED_BRAND_ORDER.filter");
    expect(header).toMatch(/candidate\.name\.toLowerCase\(\) === brand\.toLowerCase\(\)/);
  });

  it("sorts brands so a long list stays scannable", () => {
    expect(catalog).toContain("localeCompare");
  });
});

/**
 * Layout follows the Coastal Reign reference the client supplied: a
 * multi-column alphabetical list, a featured rail, and a help line.
 */
describe("Brands menu layout", () => {
  it("renders the reference's four regions", () => {
    expect(header).toContain("Shop by Brand");
    expect(header).toContain("Featured Brands");
    expect(header).toContain("View All Brands");
    expect(header).toContain("Need help? Get in touch");
  });

  it("lays the brand list out in columns", () => {
    expect(header).toMatch(/columns-2 sm:columns-3 xl:columns-4/);
  });

  it("is reachable on mobile, where the dropdown cannot be", () => {
    expect(header).toMatch(/openMobileSection === "brands"/);
  });
});
