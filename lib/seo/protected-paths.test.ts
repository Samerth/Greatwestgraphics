import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_PAGES } from "./content-pages";
import { catchAllStaticPaths, resolveLegacyRoute } from "./inventory";
import { LOCATION_PAGES } from "./location-pages";
import {
  isProtectedAppPath,
  isProtectedFirstSegment,
  isProtectedRedirectSource,
  isProtectedTreePath,
  patternPrefix,
  PROTECTED_PREFIXES,
} from "./protected-paths";
import { LEFTOVER_REDIRECTS, PREFIX_REDIRECTS } from "./leftovers";
import { getContentPage } from "./content-pages";
import { getLocationPage } from "./location-pages";
import { closestRelevantPath } from "./closest";
import { canonicalizePath } from "./paths";
import {
  nextSeoRedirects,
  resolveLegacyRedirect,
  retiredRedirects,
  transactionalRedirects,
} from "./redirects";

/** Live commerce prefixes that must never be 301'd or replaced by a landing. */
const STEAL_PREFIXES = [
  "/product",
  "/products",
  "/category",
  "/admin",
  "/api",
  "/design",
  "/studio",
  "/quote",
  "/store",
  "/account",
  "/cart",
  "/checkout",
] as const;

const COMMERCE_PAGES = [
  "/shop",
  "/cart",
  "/checkout",
  "/quote",
  "/faq",
  "/products",
  "/design",
  "/contact",
  "/account",
  "/admin",
  "/api",
  "/studio",
] as const;

function sourceTouchesPrefix(source: string, prefix: string): boolean {
  const base = canonicalizePath(patternPrefix(source));
  return base === prefix || base.startsWith(`${prefix}/`);
}

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

  it("does not put shop/product/cart/admin/studio/quote/design in the location slug map", () => {
    const locationPaths = new Set(LOCATION_PAGES.map((page) => page.path));
    for (const path of COMMERCE_PAGES) {
      expect(locationPaths.has(path), path).toBe(false);
    }
    for (const page of LOCATION_PAGES) {
      for (const prefix of STEAL_PREFIXES) {
        expect(sourceTouchesPrefix(page.path, prefix), page.path).toBe(false);
      }
    }
  });

  it("does not capture working trees via leftover or prefix 301s", () => {
    for (const from of Object.keys(LEFTOVER_REDIRECTS)) {
      for (const prefix of STEAL_PREFIXES) {
        expect(sourceTouchesPrefix(from, prefix), from).toBe(false);
      }
    }
    for (const rule of PREFIX_REDIRECTS) {
      expect(isProtectedRedirectSource(rule.source), rule.source).toBe(false);
      expect(isProtectedTreePath(patternPrefix(rule.source)), rule.source).toBe(
        false,
      );
      for (const prefix of STEAL_PREFIXES) {
        expect(sourceTouchesPrefix(rule.source, prefix), rule.source).toBe(
          false,
        );
      }
    }
  });

  it("blocks steal-prefix patterns from ever entering the redirect allowlist", () => {
    for (const prefix of STEAL_PREFIXES) {
      expect(isProtectedRedirectSource(`${prefix}/:path*`)).toBe(true);
      expect(isProtectedAppPath(`${prefix}/example`)).toBe(true);
      expect(closestRelevantPath(`${prefix}/example`)).toBe(`${prefix}/example`);
    }
    expect(isProtectedRedirectSource("/faq/:slug")).toBe(false);
    expect(isProtectedAppPath("/faq")).toBe(true);
    expect(isProtectedAppPath("/faq/old-question")).toBe(false);
  });

  it("keeps closestRelevantPath from rewriting live commerce pages", () => {
    for (const path of WORKING_PATHS) {
      const canonical = canonicalizePath(path);
      expect(closestRelevantPath(canonical)).toBe(canonical);
    }
  });
});

describe("redirect allowlist", () => {
  it("emits only explicit retire, transactional, leftover, and slash aliases — no loops", () => {
    const entries = nextSeoRedirects();
    const sources = new Set(entries.map((entry) => entry.source));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.statusCode === 301)).toBe(true);

    for (const entry of entries) {
      expect(isProtectedRedirectSource(entry.source), entry.source).toBe(false);
      expect(entry.destination).not.toBe("/");
      expect(entry.destination.endsWith("/") && entry.destination !== "/").toBe(
        false,
      );
      expect(entry.source).not.toBe(entry.destination);
      expect(sources.has(entry.destination)).toBe(false);
      for (const prefix of STEAL_PREFIXES) {
        expect(sourceTouchesPrefix(entry.source, prefix), entry.source).toBe(
          false,
        );
      }
    }

    expect(sources.has("/my-account")).toBe(true);
    expect(sources.has("/my-account/")).toBe(true);
    expect(sources.has("/cart")).toBe(false);
    expect(sources.has("/cart/")).toBe(false);
    expect(sources.has("/products")).toBe(false);
    expect(sources.has("/product/:slug")).toBe(false);
    expect(sources.has("/(.*)")).toBe(false);
    expect(sources.has("/:path*")).toBe(false);
    expect(sources.has("/category/:path*")).toBe(false);
    expect(sources.has("/product/:path*")).toBe(false);
    expect(sources.has("/products/:path*")).toBe(false);
    expect(sources.has("/admin/:path*")).toBe(false);
    expect(sources.has("/api/:path*")).toBe(false);
    expect(sources.has("/design/:path*")).toBe(false);
    expect(sources.has("/studio/:path*")).toBe(false);
    expect(sources.has("/quote/:path*")).toBe(false);
    expect(sources.has("/store/:path*")).toBe(false);
    expect(sources.has("/account/:path*")).toBe(false);
    expect(sources.has("/cart/:path*")).toBe(false);
    expect(sources.has("/checkout/:path*")).toBe(false);
  });

  it("does not wire a greedy closest-match 301 into the catch-all or PDP", () => {
    const catchAll = readFileSync(
      resolve(process.cwd(), "app/(shop)/[...slug]/page.tsx"),
      "utf8",
    );
    const product = readFileSync(
      resolve(process.cwd(), "app/(shop)/product/[slug]/page.tsx"),
      "utf8",
    );
    const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");
    const nextConfig = readFileSync(
      resolve(process.cwd(), "next.config.ts"),
      "utf8",
    );

    expect(catchAll).toContain("dynamicParams = false");
    expect(catchAll).not.toContain("closestRelevantPath");
    expect(product).not.toMatch(/permanentRedirect\(["']\/products["']\)/);
    expect(proxy).toContain("isProtectedAppPath");
    expect(proxy).toContain("_next/");
    expect(proxy).toContain("api/");
    expect(nextConfig).toContain("nextSeoRedirects()");
    expect(nextConfig).not.toMatch(/trailingSlash:\s*true/);
  });
});
