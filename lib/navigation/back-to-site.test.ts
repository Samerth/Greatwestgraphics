import { describe, expect, it } from "vitest";
import { backToSiteHref } from "./back-to-site";

describe("backToSiteHref", () => {
  it("returns the shop home by default", () => {
    expect(backToSiteHref()).toBe("/");
    expect(backToSiteHref(null)).toBe("/");
    expect(backToSiteHref("/account")).toBe("/");
    expect(backToSiteHref("/start")).toBe("/");
    expect(backToSiteHref("https://evil.example")).toBe("/");
  });

  it("returns a branded storefront when that is the login destination", () => {
    expect(backToSiteHref("/s/acme")).toBe("/s/acme");
    expect(backToSiteHref("/s/acme/products")).toBe("/s/acme");
    expect(backToSiteHref("/s/acme?tab=team")).toBe("/s/acme");
  });
});
