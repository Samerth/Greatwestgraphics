import { describe, expect, it } from "vitest";
import { CONTENT_PAGES } from "./content-pages";
import { catchAllStaticPaths, resolveLegacyRoute } from "./inventory";
import { LOCATION_PAGES } from "./location-pages";
import {
  isProtectedAppPath,
  isProtectedFirstSegment,
  PROTECTED_PREFIXES,
} from "./protected-paths";
import { LEFTOVER_REDIRECTS } from "./leftovers";
import { getContentPage } from "./content-pages";
import { getLocationPage } from "./location-pages";
import {
  nextSeoRedirects,
  resolveLegacyRedirect,
  retiredRedirects,
  transactionalRedirects,
} from "./redirects";

const WORKING_PATHS = [
  "/cart",
  "/checkout",
  "/quote",
  "/quote?method=screen",
  "/faq",
  "/products",
  "/products?category=t-shirts",
  "/product/gildan-64000",
  "/design",
  "/contact",
  "/account",
  "/account/team",
  "/admin",
  "/admin/login",
  "/api/health",
  "/api/commerce/catalog/products",
  "/portal",
  "/start",
  "/shop",
  "/s/acme",
  "/category/t-shirts",
  "/studio",
  "/store/demo",
];

describe("protected app paths", () => {
  it("does not treat sibling slugs as children of a short prefix", () => {
    expect(isProtectedAppPath("/faq")).toBe(true);
    expect(isProtectedAppPath("/faqs")).toBe(false);
    expect(isProtectedAppPath("/product/foo")).toBe(true);
    expect(isProtectedAppPath("/products")).toBe(true);
    expect(isProtectedAppPath("/s/acme")).toBe(true);
    expect(isProtectedAppPath("/safety-products")).toBe(false);
    expect(isProtectedAppPath("/screen-printing-tsawwassen")).toBe(false);
    expect(isProtectedAppPath("/support")).toBe(false);
  });

  it("keeps working shop/product/cart/admin/studio/quote/design paths out of the retire map", () => {
    const retired = {
      ...retiredRedirects(),
      ...transactionalRedirects(),
    };
    for (const path of WORKING_PATHS) {
      expect(resolveLegacyRedirect(path), path).toBeNull();
      expect(retired[path.split("?")[0] as string]).toBeUndefined();
    }
    for (const prefix of PROTECTED_PREFIXES) {
      expect(retired[prefix]).toBeUndefined();
    }
  });

  it("does not put working commerce paths in the location-page map", () => {
    for (const page of LOCATION_PAGES) {
      expect(isProtectedAppPath(page.path), page.path).toBe(false);
      expect(isProtectedFirstSegment(page.path), page.path).toBe(false);
    }
  });

  it("does not let the catch-all claim a working first segment", () => {
    for (const path of catchAllStaticPaths()) {
      expect(isProtectedAppPath(path), path).toBe(false);
      expect(isProtectedFirstSegment(path), path).toBe(false);
    }
  });

  it("treats working routes as existing even if a content alias shares a family", () => {
    expect(resolveLegacyRoute("/cart").type).toBe("existing");
    expect(resolveLegacyRoute("/checkout").type).toBe("existing");
    expect(resolveLegacyRoute("/quote").type).toBe("existing");
    expect(resolveLegacyRoute("/faq").type).toBe("existing");
    expect(resolveLegacyRoute("/products").type).toBe("existing");
    expect(resolveLegacyRoute("/product/gildan-64000").type).toBe("existing");
    expect(resolveLegacyRoute("/design").type).toBe("existing");
    expect(resolveLegacyRoute("/contact").type).toBe("existing");
    expect(resolveLegacyRoute("/account").type).toBe("existing");
    expect(resolveLegacyRoute("/admin/jobs").type).toBe("existing");
    expect(resolveLegacyRoute("/api/health").type).toBe("existing");
    expect(resolveLegacyRoute("/shop").type).toBe("existing");
    expect(resolveLegacyRoute("/faqs").type).toBe("content");
    expect(resolveLegacyRoute("/get-a-quote").type).toBe("content");
  });

  it("does not 301 a preserved location or content slug via leftovers", () => {
    for (const from of Object.keys(LEFTOVER_REDIRECTS)) {
      expect(isProtectedAppPath(from), from).toBe(false);
      expect(getLocationPage(from), from).toBeUndefined();
      expect(getContentPage(from), from).toBeUndefined();
    }
  });

  it("aliases /shop and /catalogue onto the catalogue, not a static landing row", () => {
    const shop = CONTENT_PAGES.find((page) => page.path === "/shop");
    const catalogue = CONTENT_PAGES.find((page) => page.path === "/catalogue");
    expect(shop?.mode).toBe("reuse");
    expect(shop?.reuse).toBe("products");
    expect(catalogue?.reuse).toBe("products");
    expect(LOCATION_PAGES.some((page) => page.path === "/shop")).toBe(false);
  });
});

describe("redirect allowlist", () => {
  it("only emits the retire and transactional sources, with no loops", () => {
    const entries = nextSeoRedirects();
    const sources = new Set(entries.map((entry) => entry.source));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.statusCode === 301)).toBe(true);

    for (const entry of entries) {
      expect(isProtectedAppPath(entry.source), entry.source).toBe(false);
      expect(entry.destination).not.toBe("/");
      expect(entry.destination.endsWith("/") && entry.destination !== "/").toBe(
        false,
      );
      expect(entry.source).not.toBe(entry.destination);
      expect(sources.has(entry.destination)).toBe(false);
    }

    expect(sources.has("/my-account")).toBe(true);
    expect(sources.has("/my-account/")).toBe(true);
    expect(sources.has("/cart")).toBe(false);
    expect(sources.has("/products")).toBe(false);
    expect(sources.has("/product/:slug")).toBe(false);
    expect(sources.has("/(.*)")).toBe(false);
    expect(sources.has("/:path*")).toBe(false);
    expect(sources.has("/category/:path*")).toBe(false);
    expect(sources.has("/product/:path*")).toBe(false);
  });
});
