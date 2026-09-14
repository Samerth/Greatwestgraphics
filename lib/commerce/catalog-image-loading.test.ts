import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { VENDOR_IMAGE_HOSTS, isVendorImageUrl } from "./catalog-images";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const nextConfig = read("next.config.ts");
const catalogImage = stripComments(read("components/shared/CatalogImage.tsx"));

/**
 * Client call, 10 September: "garment and model images sometimes fail to
 * appear while scrolling, but do appear once clicked."
 *
 * Every next/image request went through our own optimiser — download from
 * the vendor, resize with sharp, serve — on a half-CPU container. A scrolled
 * catalogue page asks for twenty-odd at once; they queue, some time out, and
 * the tile stays blank. Vendor photos now load straight from the vendor CDN.
 */
describe("vendor photos bypass our image optimiser", () => {
  it("recognises the three vendor CDNs", () => {
    expect(isVendorImageUrl("https://media.sanmarcanada.com/x/y.jpg")).toBe(true);
    expect(isVendorImageUrl("https://cdn.ssactivewear.com/Images/Style/1.jpg")).toBe(true);
    expect(isVendorImageUrl("https://www.ssactivewear.com/Images/Color/2.jpg")).toBe(true);
  });

  it("keeps our own assets and uploads on the optimiser", () => {
    // Local marketing photography and uploaded artwork still benefit from
    // resizing and WebP; only the vendor hotlinks were the problem.
    expect(isVendorImageUrl("/images/prod-tee.jpg")).toBe(false);
    expect(isVendorImageUrl("https://gwg-staging-uploads.s3.amazonaws.com/a.png")).toBe(false);
    expect(isVendorImageUrl("/api/uploads/proof.png")).toBe(false);
  });

  it("is not fooled by a vendor name inside another host", () => {
    expect(isVendorImageUrl("https://cdn.ssactivewear.com.evil.example/x.jpg")).toBe(false);
    expect(isVendorImageUrl("https://notmedia.sanmarcanada.com/x.jpg")).toBe(false);
  });

  it("treats a missing or malformed URL as not-vendor", () => {
    expect(isVendorImageUrl(null)).toBe(false);
    expect(isVendorImageUrl("")).toBe(false);
    expect(isVendorImageUrl("not a url")).toBe(false);
  });

  it("matches the hosts next.config.ts allows, exactly", () => {
    // Two lists of the same three hosts will drift. This holds them together:
    // a host added to one without the other fails here.
    const allowed = [...nextConfig.matchAll(/hostname:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect([...VENDOR_IMAGE_HOSTS].sort()).toEqual([...allowed].sort());
  });
});

describe("one component, not a prop at every call site", () => {
  it("sets unoptimized from the URL, so a new card cannot reintroduce the queue", () => {
    expect(catalogImage).toContain("isVendorImageUrl(src)");
    expect(catalogImage).toMatch(/unoptimized=\{unoptimized \?\? vendor\}/);
  });

  it("is what every catalogue surface renders photos through", () => {
    const surfaces = [
      "components/products/ProductsGrid.tsx",
      "components/products/BestSellersSections.tsx",
      "components/products/CatalogColorSwatches.tsx",
      "components/home/BestSellers.tsx",
      "components/pdp/PdpImageGallery.tsx",
      "components/pdp/CatalogProductDetail.tsx",
      "components/layout/HeaderSearch.tsx",
    ];
    for (const surface of surfaces) {
      const source = stripComments(read(surface));
      expect(source, `${surface} still imports next/image directly`).not.toMatch(
        /import Image from "next\/image"/,
      );
      expect(source, `${surface} does not use CatalogImage`).toContain("<CatalogImage");
    }
  });
});

/**
 * Regression found on localhost the moment vendor photos bypassed the
 * optimiser: every SanMar photo went blank while every S&S photo kept
 * loading. media.sanmarcanada.com refuses image requests that carry a
 * foreign Referer (403, hotlink protection). A server-side fetch sends no
 * Referer, so the optimiser never hit it; a browser fetch does.
 */
describe("vendor photos are fetched with no Referer", () => {
  it("sends no-referrer for vendor hosts, so hotlink protection passes", () => {
    const source = stripComments(read("components/shared/CatalogImage.tsx"));
    expect(source).toMatch(
      /referrerPolicy=\{referrerPolicy \?\? \(vendor \? "no-referrer" : undefined\)\}/,
    );
  });

  it("leaves our own assets' referrer behaviour alone", () => {
    // `undefined` for non-vendor sources: the browser default applies, as
    // it always did for /images and uploads.
    const source = stripComments(read("components/shared/CatalogImage.tsx"));
    expect(source).toContain('vendor ? "no-referrer" : undefined');
  });
});
