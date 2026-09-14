import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRICING_MASTER_V2,
  calculateQuoteV2,
  priceShopperQuoteMulti,
} from "@gwg/pricing";
import type { PricingConfigV2 } from "@gwg/contracts";
import {
  STOREFRONT_ESTIMATE_ASSUMPTIONS,
  priceStorefrontQuote,
  storefrontQuantityBreaks,
} from "./storefront-quote";

const config = PRICING_MASTER_V2 as unknown as PricingConfigV2;

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * CodSphere UAT V2 row 53: "Prices are inconsistent throughout from live quote
 * all the way to formal quote and the backend admin portal."
 *
 * They were. One 100-piece order quoted $1,404.00 on the product page and
 * $1,329.00 at the cart — the $75.00 difference being an individual-packing
 * charge the browse screens applied and the order did not. The engine was
 * right every time; five screens were each asking it a slightly different
 * question.
 *
 * These tests exist so that can never silently return. They price one order
 * down every customer-facing path and require the answers to be identical.
 */

/** The order used throughout: 100 black tees, one-colour front screen print. */
const ORDER = {
  description: "Parity tee",
  unitCostMinor: 450,
  quantity: 100,
  colourName: "Black",
  decorations: [{ id: "front", methodKey: "screenPrint", location: "front", colours: 1 }],
};

describe("row 53 — every path quotes one number", () => {
  it("product page estimate equals the Input Quantity order price", () => {
    // Product page, "estimated from" headline and catalogue card all go
    // through priceStorefrontQuote.
    const estimate = priceStorefrontQuote(config, ORDER);

    // The Input Quantity step, which is what actually reaches the cart.
    const order = priceShopperQuoteMulti(config, {
      ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
      unitCostMinor: ORDER.unitCostMinor,
      quantity: ORDER.quantity,
      colourName: ORDER.colourName,
      description: ORDER.description,
      decorations: ORDER.decorations,
    });

    expect(order.totalMinor).toBe(estimate.totalMinor);
    expect(Math.round(order.totalMinor / ORDER.quantity)).toBe(estimate.unitMinor);
  });

  it("charges no packing on any path, because the order charges none", () => {
    const estimate = priceStorefrontQuote(config, ORDER);
    const order = priceShopperQuoteMulti(config, {
      ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
      unitCostMinor: ORDER.unitCostMinor,
      quantity: ORDER.quantity,
      colourName: ORDER.colourName,
      description: ORDER.description,
      decorations: ORDER.decorations,
    });
    for (const [name, lines] of [
      ["estimate", estimate.breakdown.lines],
      ["order", order.breakdown.lines],
    ] as const) {
      expect(
        lines.filter((line) => line.kind === "packing"),
        `${name} should carry no packing line`,
      ).toHaveLength(0);
    }
  });

  it("the cart total reads back as the order total, with no rounding drift", () => {
    const order = priceShopperQuoteMulti(config, {
      ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
      unitCostMinor: ORDER.unitCostMinor,
      quantity: ORDER.quantity,
      colourName: ORDER.colourName,
      description: ORDER.description,
      decorations: ORDER.decorations,
    });
    // The cart stores dollars and multiplies back out.
    expect(Math.round(order.cartUnit * ORDER.quantity * 100)).toBe(order.totalMinor);
  });

  it("the server's authoritative reprice agrees with what was quoted", () => {
    // job-request-service re-prices the submitted snapshot against the
    // published config. Same input, so it must land on the same number.
    const estimate = priceStorefrontQuote(config, ORDER);
    const reprice = calculateQuoteV2(estimate.input, config);
    expect(reprice.totals.totalMinor).toBe(estimate.totalMinor);
  });

  it("holds at every quantity break, not just the one that was reported", () => {
    const anchors = [24, 48, 100, 250, 500];
    const breaks = storefrontQuantityBreaks(config, ORDER, anchors);
    expect(breaks.length).toBeGreaterThan(0);
    for (const { qty, unitMinor } of breaks) {
      const order = priceShopperQuoteMulti(config, {
        ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
        unitCostMinor: ORDER.unitCostMinor,
        quantity: qty,
        colourName: ORDER.colourName,
        description: ORDER.description,
        decorations: ORDER.decorations,
      });
      expect(
        Math.round(order.totalMinor / qty),
        `unit price disagrees at ${qty} pieces`,
      ).toBe(unitMinor);
    }
  });

  it("holds for a multi-decoration order too, not only a single print", () => {
    const twoPlacements = {
      ...ORDER,
      decorations: [
        { id: "front", methodKey: "screenPrint", location: "front", colours: 2 },
        { id: "back", methodKey: "screenPrint", location: "back", colours: 1 },
      ],
    };
    const estimate = priceStorefrontQuote(config, twoPlacements);
    const order = priceShopperQuoteMulti(config, {
      ...STOREFRONT_ESTIMATE_ASSUMPTIONS,
      unitCostMinor: twoPlacements.unitCostMinor,
      quantity: twoPlacements.quantity,
      colourName: twoPlacements.colourName,
      description: twoPlacements.description,
      decorations: twoPlacements.decorations,
    });
    expect(order.totalMinor).toBe(estimate.totalMinor);
  });

  it("keeps two decorations on one location separately attributable", () => {
    // Without an explicit id both rows were keyed `decoration-front` and the
    // product page could not tell their costs apart.
    const { breakdown } = priceStorefrontQuote(config, {
      ...ORDER,
      decorations: [
        { id: "row-a", methodKey: "screenPrint", location: "front", colours: 1 },
        { id: "row-b", methodKey: "screenPrint", location: "front", colours: 3 },
      ],
    });
    const ids = new Set(
      breakdown.lines.map((line) => line.decorationId).filter(Boolean),
    );
    expect(ids.has("row-a")).toBe(true);
    expect(ids.has("row-b")).toBe(true);
  });
});

/**
 * The regression was possible because each screen hand-built its own engine
 * request. Guard the shape of the fix, not only its current output.
 */
describe("row 53 — no screen builds its own pricing request", () => {
  const surfaces: [string, string][] = [
    ["catalogue card", "lib/commerce/catalog-card.ts"],
    ["product page estimate", "components/pdp/PdpDetailedQuote.tsx"],
    ["estimated-from headline", "components/pdp/PdpStartingPrice.tsx"],
  ];

  it("routes every browse surface through the shared builder", () => {
    for (const [name, path] of surfaces) {
      const source = stripComments(read(path));
      expect(source, `${name} should use the shared builder`).toMatch(
        /priceStorefrontQuote|storefrontQuantityBreaks/,
      );
    }
  });

  it("leaves no hand-assembled options block behind", () => {
    for (const [name, path] of surfaces) {
      const source = stripComments(read(path));
      expect(source, `${name} still sets its own packing option`).not.toMatch(
        /includePacking:\s*true/,
      );
      expect(source, `${name} still calls the engine directly`).not.toMatch(
        /calculateQuoteV2\(/,
      );
    }
  });

  it("has the order path spread the same assumptions rather than restate them", () => {
    const quantityStep = stripComments(read("components/design/QuantityStep.tsx"));
    expect(quantityStep).toContain("...STOREFRONT_ESTIMATE_ASSUMPTIONS");
    expect(quantityStep).not.toMatch(/shareSetup:\s*(true|false)/);
  });

  it("has the quote builder follow them too", () => {
    const builder = stripComments(read("components/quote-builder/QuoteBuilder.tsx"));
    expect(builder).toContain("STOREFRONT_ESTIMATE_ASSUMPTIONS.shareSetup");
    expect(builder).not.toMatch(/shareSetup:\s*true/);
  });
});
