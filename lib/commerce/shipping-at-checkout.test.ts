import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Strip comments so an assertion never matches prose that quotes it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const cart = stripComments(read("app/(shop)/cart/page.tsx"));
const home = stripComments(read("components/home/FigmaHomeSections.tsx"));
const quantity = stripComments(read("components/design/QuantityStep.tsx"));
const pdpQuote = stripComments(read("components/pdp/PdpDetailedQuote.tsx"));
const faq = read("app/(shop)/faq/page.tsx");

/**
 * Client decision, 11 September 2026, recorded as CLOSED: "shipping charges
 * appear at checkout only, not on other pages."
 *
 * The line these tests hold is between a shipping *charge* — a price, or a
 * promise about one — and shipping *information*, which stays. Saying we ship
 * Canada-wide, or that shipping is added later, is not quoting a charge.
 */
describe("no shipping charge is quoted outside checkout", () => {
  it("keeps the cart's order summary free of a shipping price row", () => {
    expect(cart).not.toMatch(/SummaryRow[^>]*label=["'`]Shipping/);
    expect(cart).not.toContain("Shipping (Vancouver)");
  });

  it("makes no free-shipping promise on the homepage", () => {
    expect(home).not.toMatch(/free shipping/i);
  });

  it("promises nothing unconditional anywhere a shopper browses", () => {
    // The specific over-promise that was live: free shipping on everything,
    // when the threshold is $300.
    for (const source of [cart, home, quantity, pdpQuote]) {
      expect(source).not.toMatch(/free shipping for all/i);
    }
  });
});

describe("the shopper is still told where shipping lands", () => {
  it("says so in the cart, without quoting a price", () => {
    expect(cart).toContain('data-cart="shipping-note"');
    expect(cart).toMatch(/Shipping and tax are calculated at checkout/);
  });

  it("keeps the same expectation set at the quantity step", () => {
    expect(quantity).toMatch(/shipping are added at checkout/i);
  });

  it("keeps the estimate's before-shipping disclaimer on the product page", () => {
    // This one says shipping is *excluded*, which is the decision working as
    // intended rather than a charge being quoted.
    expect(pdpQuote).toMatch(/before tax .{0,12} shipping/i);
  });

  it("still keeps a delivery timeline in the cart", () => {
    // Transit time is not a charge, and removing it would cost the shopper
    // real information for no reason.
    expect(cart).toMatch(/Shipping: 2–3 days/);
  });
});

describe("the free-shipping threshold is stated consistently", () => {
  it("uses $300 in the FAQ, matching the client's confirmation", () => {
    // Confirmed by the client on 13 September: "Free shipping over $300
    // across Canada." UAT row 65's $250 is the outlier and is being corrected
    // to match.
    expect(faq).toContain("$300");
    expect(faq).not.toContain("$250");
  });
});
