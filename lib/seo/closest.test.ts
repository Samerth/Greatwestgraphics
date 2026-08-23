import { describe, expect, it } from "vitest";
import { closestRelevantPath } from "./closest";
import { getContentPage } from "./content-pages";
import { LEFTOVER_REDIRECTS } from "./leftovers";
import { getLocationPage } from "./location-pages";
import { resolveLegacyRedirect, retiredRedirects } from "./redirects";

describe("closestRelevantPath", () => {
  it("never dumps leftovers on the homepage", () => {
    for (const [from, to] of Object.entries(LEFTOVER_REDIRECTS)) {
      expect(to).not.toBe("/");
      expect(closestRelevantPath(from)).toBe(to);
      expect(getLocationPage(to) ?? getContentPage(to), to).toBeTruthy();
    }
    expect(closestRelevantPath("/")).toBe("/services");
    expect(closestRelevantPath("/this-was-never-a-page")).not.toBe("/");
  });

  it("maps WordPress leftover prefixes to a relevant page", () => {
    expect(closestRelevantPath("/faq/can-i-get-free-shipping/")).toBe("/faqs");
    expect(closestRelevantPath("/product-category/t-shirts/short-sleeves")).toBe(
      "/products",
    );
    expect(closestRelevantPath("/tag/heat-transfer")).toBe(
      "/blogs-screen-printing",
    );
  });

  it("keeps the two retire 301s and the four live -2 slugs distinct", () => {
    expect(retiredRedirects()["/promotional-products-burnaby-2"]).toBe(
      "/promotional-products-burnaby",
    );
    expect(retiredRedirects()["/safety-products-2"]).toBe("/safety-products");
    expect(resolveLegacyRedirect("/promotional-products-richmond-2")).toBeNull();
    expect(resolveLegacyRedirect("/custom-embroidered-toques-surrey-2")).toBeNull();
    expect(resolveLegacyRedirect("/screen-printed-custom-t-shirts-2")).toBeNull();
    expect(resolveLegacyRedirect("/t-shirt-printing-2")).toBeNull();
  });
});
