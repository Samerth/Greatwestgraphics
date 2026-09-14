import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { STANDARD_TURNAROUND_LABEL } from "@/lib/schemas/checkout";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const faq = stripComments(read("app/(shop)/faq/page.tsx"));
const pdp = stripComments(read("components/pdp/PdpEnrichment.tsx"));
const cart = stripComments(read("app/(shop)/cart/page.tsx"));
const seo = stripComments(read("lib/seo/thin-copy.ts"));

/**
 * Client decision, 13 September 2026, answering a direct question about which
 * standard turnaround figure was correct: "5-7 days".
 *
 * The site had been telling customers two different things — 5–7 at checkout,
 * 7–10 on the product page and in the FAQ.
 */
describe("standard turnaround is stated as 5–7 everywhere a customer reads it", () => {
  it("says 5–7 at checkout", () => {
    expect(STANDARD_TURNAROUND_LABEL).toContain("5–7 Business Days");
  });

  it("says 5–7 in the FAQ", () => {
    expect(faq).toMatch(/Standard production is 5–7 business days/);
  });

  it("says 5–7 on the product page", () => {
    expect(pdp).toMatch(/Standard 5–7 business days/);
  });

  it("no longer says 7–10 on any customer-facing page", () => {
    for (const source of [faq, pdp, cart]) {
      expect(source).not.toMatch(/7–10/);
    }
  });

  it("already said 5–7 in the location and service copy", () => {
    // These were right all along; this guards them against drifting the
    // other way.
    expect(seo).toMatch(/5–7 business days/);
  });
});

/**
 * UAT row 50 changed rush from a priced product into a request that staff
 * confirm. Copy promising a fixed 48-hour turnaround "for an added fee" is a
 * commitment checkout no longer makes.
 */
describe("rush is described as a request, not a purchase", () => {
  it("does not sell a fixed 48-hour turnaround in the FAQ", () => {
    expect(faq).not.toMatch(/48-hour turnaround is available for an added fee/);
    expect(faq).toMatch(/request rush production at checkout/i);
  });

  it("tells the customer our team confirms the date and any charge", () => {
    // The same promise the checkout disclaimer makes, so the two agree.
    expect(faq).toMatch(/confirm availability and any rush charge/i);
  });

  it("does not quote a fixed rush window on the product page", () => {
    expect(pdp).not.toMatch(/48-hour Quick Order available/);
    expect(pdp).toMatch(/rush available on request/i);
  });
});

/**
 * UAT row 65 asked for "$250+". The client then confirmed $300 on
 * 13 September, which supersedes it.
 */
describe("the free shipping threshold is $300 and nothing says otherwise", () => {
  it("never mentions $250 in any customer-facing copy", () => {
    for (const source of [faq, pdp, cart, seo]) {
      expect(source).not.toContain("$250");
    }
  });

  it("states $300 in the FAQ", () => {
    expect(faq).toContain("$300");
  });
});
