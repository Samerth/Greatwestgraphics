import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import type { PricingConfigV2 } from "@gwg/contracts";
import { customerUnitMinor, priceStorefrontQuote } from "./storefront-quote";

const config = PRICING_MASTER_V2 as unknown as PricingConfigV2;

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const quantityStep = stripComments(read("components/design/QuantityStep.tsx"));
const quoteBuilder = stripComments(
  read("components/quote-builder/QuoteBuilder.tsx"),
);
const calculatorTab = stripComments(
  read("components/portal/pricing/v2/CalculatorTab.tsx"),
);

const ORDER = {
  description: "Setup test tee",
  unitCostMinor: 450,
  quantity: 100,
  colourName: "Black",
  decorations: [
    { id: "front", methodKey: "screenPrint", location: "front", colours: 1 },
  ],
};

/**
 * CodSphere UAT V2 row 48: "Consolidate 'set up' into the per unit price.
 * Customers do not need to see the set up charges. Do this for all live and
 * formal quotes."
 *
 * The engine reports a per-piece price that excludes setup and a total that
 * includes it — right for staff, who price each part separately. Shown to a
 * customer it produced a per-piece figure that would not multiply out to the
 * total, plus a separate setup line to explain the gap.
 */
describe("setup folded into the customer's per-piece price", () => {
  it("multiplies out to the total the customer is also shown", () => {
    const { totalMinor } = priceStorefrontQuote(config, ORDER);
    const unit = customerUnitMinor(totalMinor, ORDER.quantity);
    // Within one cent per piece of rounding, and no further.
    expect(Math.abs(unit * ORDER.quantity - totalMinor)).toBeLessThanOrEqual(
      ORDER.quantity,
    );
  });

  it("is higher than the engine's bare per-piece price when setup applies", () => {
    const { breakdown, totalMinor } = priceStorefrontQuote(config, ORDER);
    const setupMinor = breakdown.totals.setupMinor;
    expect(setupMinor, "fixture should carry a setup fee").toBeGreaterThan(0);

    const consolidated = customerUnitMinor(totalMinor, ORDER.quantity);
    const bare = breakdown.garments[0]?.unitPriceMinor ?? 0;
    expect(consolidated).toBeGreaterThan(bare);
  });

  it("spreads setup thinner as quantity rises, so bigger runs really are cheaper", () => {
    const at24 = priceStorefrontQuote(config, { ...ORDER, quantity: 24 });
    const at500 = priceStorefrontQuote(config, { ...ORDER, quantity: 500 });
    expect(customerUnitMinor(at500.totalMinor, 500)).toBeLessThan(
      customerUnitMinor(at24.totalMinor, 24),
    );
  });

  it("never divides by zero on an empty order", () => {
    expect(customerUnitMinor(5000, 0)).toBe(5000);
  });
});

describe("setup is no longer shown to the customer as a charge", () => {
  it("the Input Quantity step shows no separate setup line", () => {
    expect(quantityStep).not.toMatch(/One-off setup/);
    expect(quantityStep).toContain("customerUnitMinor(quote.totalMinor, totalQty)");
  });

  it("the quote builder shows no setup disclosure", () => {
    expect(quoteBuilder).not.toMatch(/One-time setup/);
    expect(quoteBuilder).not.toContain("oneTimeFeesMinor");
    expect(quoteBuilder).not.toContain("setupOpen");
  });

  it("the quote builder's per-piece price carries setup", () => {
    expect(quoteBuilder).toContain("customerUnitMinor(quoted.totalMinor, qty)");
  });

  it("compares like with like when quoting a saving at the next break", () => {
    // The nudge must not compare a consolidated price against a bare one.
    expect(quoteBuilder).toContain(
      "customerUnitMinor(atNextBreak.totalMinor, nextBreak)",
    );
  });
});

/**
 * Row 48 is about what a *customer* sees. Staff still price setup separately,
 * so the pricing admin must keep the split.
 */
describe("staff screens keep the setup breakdown", () => {
  it("the pricing calculator still reports setup on its own", () => {
    expect(calculatorTab).toContain("totals.setupMinor");
  });

  it("the engine still returns setup separately", () => {
    const { breakdown } = priceStorefrontQuote(config, ORDER);
    expect(breakdown.totals.setupMinor).toBeGreaterThan(0);
    expect(breakdown.lines.some((line) => line.kind === "setup")).toBe(true);
  });
});

/**
 * Found on 15 September, on the quantity step for a 24-piece run: the Black
 * colour row read $1,059.12 / $44.13 ea while the "Your price" box on the
 * same page read $1,094.12 / $45.59. The $35 between them was the
 * screen-print setup fee. Row 48 folded setup into the unit price in the box
 * but left this row on the engine's raw per-piece, which excludes it.
 */
describe("row 48 — every per-piece figure on the quantity step includes setup", () => {
  const quantity = stripComments(read("components/design/QuantityStep.tsx"));

  it("prices the colour row from the same total-divided-by-quantity as the box", () => {
    // Two figures on one page must not disagree about the same 24 pieces.
    expect(quantity).toMatch(
      /customerUnitMinor\(quote\.totalMinor, totalQty\) \* qty/,
    );
  });

  it("no longer renders the engine's setup-free per-piece anywhere", () => {
    // `perPieceMinor` is documented as "setup left off" and must not reach
    // the customer.
    expect(quantity).not.toMatch(/quote\.perPieceMinor/);
  });
});
