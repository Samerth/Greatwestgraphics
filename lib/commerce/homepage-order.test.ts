import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/**
 * Assertions here are about what the page renders, so they must not match the
 * comments explaining what was removed — those deliberately name the very
 * strings ("I need uniforms", "Open design studio") the tests check for.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const homepage = stripComments(read("app/(shop)/page.tsx"));
const figmaSections = stripComments(read("components/home/FigmaHomeSections.tsx"));
const homeSections = stripComments(read("components/home/HomeFigmaSections.tsx"));

/** Order the sections actually render in, top to bottom. */
function sectionOrder(source: string): string[] {
  return [...source.matchAll(/<([A-Z][A-Za-z]*)\s*(?:\/>|categories=|products=)/g)]
    .map((match) => match[1]!)
    .filter((name) => name !== "Reveal");
}

/**
 * CodSphere UAT V2 row 63: drop the "I need uniforms / I need promo products /
 * I have my own design" trio, promote the four "how to order" steps into the
 * slot it held directly under the hero, and move the trust strip down to the
 * position the four steps vacated.
 */
describe("homepage section order (row 63)", () => {
  const order = sectionOrder(homepage);

  it("no longer renders the three self-classification tabs", () => {
    expect(homepage).not.toContain("QuickPaths");
    expect(homeSections).not.toContain("export function QuickPaths");
    expect(homeSections).not.toContain("I need uniforms");
    expect(homeSections).not.toContain("I need promo products");
    expect(homeSections).not.toContain("I have my own design");
  });

  it("opens on the hero, then the four steps", () => {
    expect(order[0]).toBe("Hero");
    expect(order[1]).toBe("HowToOrder");
  });

  it("moves the trust strip below the gallery and shop sections", () => {
    const trust = order.indexOf("TrustStrip");
    expect(trust).toBeGreaterThan(order.indexOf("Gallery"));
    expect(trust).toBeGreaterThan(order.indexOf("VisitShop"));
    // It used to sit third, immediately under the hero's neighbour.
    expect(trust).toBeGreaterThan(3);
  });

  it("keeps every remaining section exactly once", () => {
    for (const name of [
      "Hero",
      "HowToOrder",
      "IdeaToDelivery",
      "CategoryBrowse",
      "BestSellers",
      "Testimonials",
      "PrintMethods",
      "Gallery",
      "VisitShop",
      "TrustStrip",
      "OrderNowBand",
      "StatsBand",
      "CtaBand",
    ]) {
      expect(order.filter((s) => s === name), `${name} renders once`).toHaveLength(1);
    }
  });
});

/**
 * Row 64: the opening step sends the visitor to Best Sellers, and the "Open
 * design studio" call to action is removed — the same instruction as rows 56
 * and 57, which took the studio out of the header and the nav.
 */
describe("four-step call to actions (row 64)", () => {
  it("starts an order on the Best Sellers listing", () => {
    expect(figmaSections).toContain(
      // Row 64 says this leads to Best Sellers. Row 68 then gave Best Sellers
      // a page of its own, so it points there rather than at a filtered view.
      '{ label: "Start an order", href: "/best-sellers" }',
    );
  });

  it("no longer offers a quote form as the first step", () => {
    expect(figmaSections).not.toContain('label: "Start a quote"');
  });

  it("has no Open design studio call to action", () => {
    expect(figmaSections).not.toMatch(/Open design studio/i);
  });

  it("sends every Start an Order button to Best Sellers, not just step 01", () => {
    // The section's own footer button and the closing band each carried a
    // "start an order" that still went elsewhere - the quote page and the
    // bare design studio (15 Sep).
    expect(figmaSections).not.toMatch(/href="\/quote"[^>]*>\s*Start an Order/);
    expect(figmaSections).toMatch(/href="\/best-sellers"[^>]*>\s*Start an Order/);
    const staticSections = stripComments(read("components/home/StaticSections.tsx"));
    expect(staticSections).not.toContain('href="/design"');
    expect(staticSections).not.toMatch(/Start Designing/);
    expect(staticSections).toMatch(/href="\/best-sellers"[\s\S]{0,300}?Start an Order/);
    // The footer's Start an Order went to the full catalogue.
    const footer = stripComments(read("components/layout/Footer.tsx"));
    expect(footer).toContain('{ label: "Start an Order", href: "/best-sellers" }');
  });

  it("leaves no bare studio entry point on the product page or SEO landings", () => {
    // "Open Design Studio" under the product page's artwork FAQ and the
    // "Design studio" button on every location/service landing page both
    // opened the studio with no garment chosen (15 Sep).
    const pdp = stripComments(read("components/pdp/PdpEnrichment.tsx"));
    expect(pdp).not.toContain('href="/design"');
    expect(pdp).not.toMatch(/Open Design Studio/);
    const landing = stripComments(read("components/seo/SeoLanding.tsx"));
    expect(landing).not.toContain('href="/design"');
    expect(landing).toMatch(/href="\/best-sellers"[\s\S]{0,120}?Best sellers/);
  });

  it("renders a step with no call to action rather than crashing", () => {
    // Step 02 now carries no cta, so the link has to be conditional.
    expect(figmaSections).toContain("{step.cta && (");
    expect(figmaSections).toContain("cta?: { label: string; href: string }");
  });
});
