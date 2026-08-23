import { describe, expect, it } from "vitest";
import { canonicalizePath } from "./paths";
import {
  nextSeoRedirects,
  PRESERVED_ODD_SLUGS,
  resolveLegacyRedirect,
  retiredRedirects,
  transactionalRedirects,
} from "./redirects";
import { getContentPage } from "./content-pages";
import { getLocationPage } from "./location-pages";

describe("resolveLegacyRedirect", () => {
  it("retires the two genuine -2 duplicates to their canonical pages", () => {
    expect(resolveLegacyRedirect("/promotional-products-burnaby-2/")).toBe(
      "/promotional-products-burnaby",
    );
    expect(
      resolveLegacyRedirect(
        "https://www.greatwestgraphics.com/safety-products-2/",
      ),
    ).toBe("/safety-products");
  });

  it("does not treat the four live -2 slugs as duplicates", () => {
    for (const path of PRESERVED_ODD_SLUGS) {
      expect(resolveLegacyRedirect(path)).toBeNull();
      expect(resolveLegacyRedirect(`${path}/`)).toBeNull();
      const page = getLocationPage(path) ?? getContentPage(path);
      expect(page, `preserved slug missing a page: ${path}`).toBeTruthy();
    }
  });

  it("maps old WooCommerce account and payment paths onto the new app", () => {
    expect(resolveLegacyRedirect("/my-account")).toBe("/account");
    expect(resolveLegacyRedirect("/payment-confirmation")).toBe("/checkout");
    expect(resolveLegacyRedirect("/secure-payment")).toBe("/checkout");
    expect(resolveLegacyRedirect("/thank-you")).toBe("/account");
    expect(resolveLegacyRedirect("/my-wishlist")).toBe("/products");
    expect(resolveLegacyRedirect("/payment")).toBe("/checkout");
  });

  it("does not redirect cart or checkout — those paths already exist", () => {
    expect(resolveLegacyRedirect("/cart")).toBeNull();
    expect(resolveLegacyRedirect("/checkout")).toBeNull();
  });

  it("does not redirect working commerce prefixes", () => {
    for (const path of [
      "/products",
      "/product/gildan-64000",
      "/quote",
      "/design",
      "/faq",
      "/contact",
      "/account",
      "/admin",
      "/api/health",
      "/shop",
    ]) {
      expect(resolveLegacyRedirect(path)).toBeNull();
    }
  });

  it("never falls through to the homepage", () => {
    expect(resolveLegacyRedirect("/this-url-was-never-in-the-sitemap")).toBeNull();
    expect(resolveLegacyRedirect("/screen-printing-tsawwassen")).toBeNull();
    for (const to of Object.values({
      ...retiredRedirects(),
      ...transactionalRedirects(),
    })) {
      expect(to).not.toBe("/");
    }
  });
});

describe("nextSeoRedirects", () => {
  it("emits 301s for both slash styles", () => {
    const entries = nextSeoRedirects();
    expect(entries.every((entry) => entry.statusCode === 301)).toBe(true);
    expect(
      entries.some(
        (entry) =>
          entry.source === "/safety-products-2" &&
          entry.destination === "/safety-products",
      ),
    ).toBe(true);
    expect(
      entries.some(
        (entry) =>
          entry.source === "/safety-products-2/" &&
          entry.destination === "/safety-products",
      ),
    ).toBe(true);
    expect(
      entries.some((entry) =>
        PRESERVED_ODD_SLUGS.includes(
          canonicalizePath(entry.source) as (typeof PRESERVED_ODD_SLUGS)[number],
        ),
      ),
    ).toBe(false);
  });
});
