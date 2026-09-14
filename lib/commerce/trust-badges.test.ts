import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Comments name the old wording on purpose, so they must not be searched. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const enrichment = stripComments(read("components/pdp/PdpEnrichment.tsx"));
const cart = stripComments(read("app/(shop)/cart/page.tsx"));

/**
 * CodSphere UAT V2 row 58: "Proof before print" becomes "Pay after proof".
 *
 * The same badge is rendered from three separate places — the product page's
 * trust cards, the product page's compact check list, and the cart's trust
 * strip. They are not driven by a shared constant, so the thing most likely to
 * go wrong is one of the three being updated and the others left behind.
 */
describe("the pay-after-proof trust badge (row 58)", () => {
  const sites: [string, string][] = [
    ["PDP trust cards", enrichment],
    ["cart trust strip", cart],
  ];

  it("uses the new wording everywhere it is rendered", () => {
    for (const [name, source] of sites) {
      expect(source, `${name} should say "Pay after proof"`).toContain(
        "Pay after proof",
      );
    }
    // Rendered twice within the product page: the card and the check list.
    expect(enrichment.match(/Pay after proof/g)).toHaveLength(2);
  });

  it("has no render site left on the old wording", () => {
    for (const [name, source] of sites) {
      expect(source, `${name} still says "Proof before print"`).not.toMatch(
        /Proof before print/i,
      );
    }
  });

  it("keeps the badge it sits beside, so only this one label moved", () => {
    for (const [name, source] of sites) {
      expect(source, `${name} lost its neighbouring badge`).toContain(
        "Reprint guarantee",
      );
    }
  });

  it("does not touch the prose that describes proofing itself", () => {
    // "You approve a digital proof before anything goes to press" is a true
    // sentence about the process, not a label, and row 58 does not ask for it.
    const seoCopy = read("lib/seo/content-pages.ts");
    expect(seoCopy).toMatch(/proof before/i);
  });
});
