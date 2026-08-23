import { describe, expect, it } from "vitest";
import { CONTENT_PAGES } from "./content-pages";
import { sitemapLegacyPaths } from "./inventory";
import { LOCATION_PAGES } from "./location-pages";
import { retiredRedirects } from "./redirects";

describe("sitemap inventory", () => {
  it("includes every preserved location and general-content URL", () => {
    const paths = new Set(sitemapLegacyPaths());
    expect(LOCATION_PAGES).toHaveLength(154);
    for (const page of LOCATION_PAGES) {
      expect(paths.has(page.path), page.path).toBe(true);
    }
    const general = CONTENT_PAGES.filter((page) => page.mode !== "flag");
    expect(general).toHaveLength(37);
    for (const page of general) {
      expect(paths.has(page.canonicalPath ?? page.path), page.path).toBe(true);
    }
  });

  it("excludes retired, transactional noise and flagged-internal pages", () => {
    const paths = sitemapLegacyPaths();
    expect(paths).not.toContain("/promotional-products-burnaby-2");
    expect(paths).not.toContain("/safety-products-2");
    expect(paths).not.toContain("/xyz-school");
    expect(paths).not.toContain("/monthly-specials");
    expect(paths).not.toContain("/custom-store-website-builder");
    expect(paths).not.toContain("/cart");
    expect(paths).not.toContain("/checkout");
    expect(paths).not.toContain("/my-account");
    for (const from of Object.keys(retiredRedirects())) {
      expect(paths).not.toContain(from);
    }
  });
});
