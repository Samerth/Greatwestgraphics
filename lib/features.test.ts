import { describe, expect, it } from "vitest";
import {
  SHOW_DESIGN_STUDIO_AI_CONCEPT,
  SHOW_PUBLIC_QUOTE_CALCULATOR,
  isPublicQuotePath,
  publicPrintMethodHref,
  publicQuoteOrFallback,
  withoutPublicQuoteLinks,
} from "./features";

describe("shopper feature flags", () => {
  it("keeps the quote calculator and studio AI concept hidden", () => {
    expect(SHOW_PUBLIC_QUOTE_CALCULATOR).toBe(false);
    expect(SHOW_DESIGN_STUDIO_AI_CONCEPT).toBe(false);
  });

  it("recognizes public quote calculator paths", () => {
    expect(isPublicQuotePath("/quote")).toBe(true);
    expect(isPublicQuotePath("/quote?method=screen")).toBe(true);
    expect(isPublicQuotePath("/get-a-quote")).toBe(true);
    expect(isPublicQuotePath("/products")).toBe(false);
    expect(isPublicQuotePath("/admin/quotes")).toBe(false);
  });

  it("strips quote calculator links from public lists", () => {
    expect(
      withoutPublicQuoteLinks([
        { href: "/products", label: "Shop" },
        { href: "/quote", label: "Get a Quote" },
        { path: "/get-a-quote", label: "Quote" },
        { href: "/design", label: "Studio" },
      ]).map((item) => item.label),
    ).toEqual(["Shop", "Studio"]);
  });

  it("sends print-method tiles to live service pages while the calculator is hidden", () => {
    expect(publicPrintMethodHref("embroidery")).toBe(
      "/decoration-processes/embroidery",
    );
    expect(publicPrintMethodHref("screen")).toBe(
      "/decoration-processes/custom-screen-printing",
    );
    expect(publicPrintMethodHref("dtf")).toBe("/services");
    expect(publicQuoteOrFallback("/contact")).toBe("/contact");
  });
});
