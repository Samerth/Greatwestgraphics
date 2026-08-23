import { describe, expect, it } from "vitest";
import { CONTENT_PAGES } from "./content-pages";
import {
  catchAllStaticPaths,
  EXISTING_TRANSACTIONAL_PATHS,
  resolveLegacyRoute,
  sitemapLegacyPaths,
} from "./inventory";
import { LOCATION_PAGES } from "./location-pages";
import { canonicalizePath, segmentsFromPath } from "./paths";
import {
  retiredRedirects,
  transactionalRedirects,
} from "./redirects";

const SPEC_INVENTORY = [
  ...LOCATION_PAGES.map((page) => page.path),
  ...CONTENT_PAGES.map((page) => page.path),
  ...EXISTING_TRANSACTIONAL_PATHS,
  ...Object.keys(transactionalRedirects()),
  ...Object.keys(retiredRedirects()),
  "/",
];

describe("WordPress URL inventory", () => {
  it("covers the 205 sitemap URLs without overlapping dispositions", () => {
    const unique = new Set(SPEC_INVENTORY.map(canonicalizePath));
    expect(LOCATION_PAGES).toHaveLength(154);
    expect(CONTENT_PAGES).toHaveLength(40);
    expect(unique.size).toBe(205);
  });

  it("resolves every inventoried URL to something other than missing or /", () => {
    for (const path of uniqueInventory()) {
      const route = resolveLegacyRoute(path);
      expect(route.type, path).not.toBe("missing");
      if (route.type === "redirect") {
        expect(route.to).not.toBe("/");
        expect(resolveLegacyRoute(route.to).type).not.toBe("missing");
      }
    }
  });

  it("keeps typo slugs that are the live WordPress URLs", () => {
    expect(resolveLegacyRoute("/screen-printing-and-embroidery-yakima-washingto").type).toBe(
      "location",
    );
    expect(
      resolveLegacyRoute("/custom-screen-printing-langley-digtal-printing").type,
    ).toBe("location");
  });

  it("gives every location page an H1, title, city and meta description", () => {
    for (const page of LOCATION_PAGES) {
      expect(page.h1.length).toBeGreaterThan(0);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.city.length).toBeGreaterThan(0);
    }
    expect(LOCATION_PAGES.filter((page) => page.thin)).toHaveLength(10);
  });

  it("builds catch-all params for nested location paths", () => {
    expect(
      catchAllStaticPaths().map(segmentsFromPath),
    ).toContainEqual([
      "decoration-processes",
      "custom-screen-printing",
      "vancouver",
    ]);
    expect(sitemapLegacyPaths()).toContain("/screen-printing-tsawwassen");
    expect(sitemapLegacyPaths()).not.toContain("/xyz-school");
    expect(sitemapLegacyPaths()).not.toContain("/promotional-products-burnaby-2");
  });
});

function uniqueInventory(): string[] {
  return [...new Set(SPEC_INVENTORY.map(canonicalizePath))];
}
