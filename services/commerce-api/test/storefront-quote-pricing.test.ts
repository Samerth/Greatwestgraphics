import { describe, expect, it } from "vitest";
import type { PricingConfigV2 } from "@gwg/contracts";
import { calculateQuoteV2, PRICING_MASTER_V2 } from "@gwg/pricing";
import {
  buildStorefrontDecorations,
  normalizeStorefrontDecorations,
  STOREFRONT_GARMENT_ID,
} from "../src/application/storefront-quote-decorations.js";
import { storefrontUnitPriceMinor } from "../src/application/storefront-quote-pricing.js";

/**
 * 21 Sep, from Pavin's client-meeting notes: "check pricing per unit vs
 * total slightly off? Rounding error?" and "per unit cost should include
 * all other prices." Not rounding - `POST /pricing/quote` was reporting
 * `unit_price` from the engine's staff-facing `garments[].unitPriceMinor`,
 * which deliberately excludes setup, next to a `total` that includes it. A
 * customer (or CodChat) multiplying unit_price by qty landed short of the
 * total by exactly the setup fee. These pin `unit_price = total / qty`,
 * which always reconciles, for the real shapes a quote takes.
 */
describe("storefrontUnitPriceMinor", () => {
  const config = PRICING_MASTER_V2 as PricingConfigV2;
  const storefront = config.storefront;

  function totalFor(method: string, extra: Record<string, unknown> = {}) {
    const decorations = buildStorefrontDecorations(
      normalizeStorefrontDecorations([
        { method, location: "front", is_oversized: false, ...extra },
      ]),
      storefront,
    );
    const breakdown = calculateQuoteV2(
      {
        garments: [
          {
            id: STOREFRONT_GARMENT_ID,
            description: "test",
            unitCostMinor: 3150,
            quantity: 100,
            colourName: "",
          },
        ],
        decorations,
        options: {
          rush: false,
          includePacking: false,
          namesNumbers: false,
          shippingCostMinor: 0,
          designHours: 0,
        },
      },
      config,
    );
    return breakdown;
  }

  it("multiplies out to the total exactly, unlike the engine's per-piece figure", () => {
    const breakdown = totalFor("screen_print");
    const unit = storefrontUnitPriceMinor(breakdown, 100);

    // The bug, pinned: the engine's own per-piece figure excludes setup, so
    // it is strictly less than the customer-facing unit price whenever a
    // setup fee applies (a screen print always carries one).
    const enginePerPiece = breakdown.garments[0]!.unitPriceMinor;
    expect(breakdown.totals.setupMinor).toBeGreaterThan(0);
    expect(unit).toBeGreaterThan(enginePerPiece);

    // The fix, pinned: total / qty reconciles to the cent (a 100-piece run
    // divides evenly, so no rounding remainder to reason about here).
    expect(unit * 100).toBe(breakdown.totals.totalMinor);
  });

  it("still reconciles when the total does not divide evenly by quantity", () => {
    // 3 colours, odd totals are exactly where a rounding mismatch would show.
    const decorations = buildStorefrontDecorations(
      normalizeStorefrontDecorations([
        { method: "screen_print", location: "front", colours: 3, is_oversized: false },
      ]),
      storefront,
    );
    const breakdown = calculateQuoteV2(
      {
        garments: [
          {
            id: STOREFRONT_GARMENT_ID,
            description: "test",
            unitCostMinor: 3150,
            quantity: 97,
            colourName: "",
          },
        ],
        decorations,
        options: {
          rush: false,
          includePacking: false,
          namesNumbers: false,
          shippingCostMinor: 0,
          designHours: 0,
        },
      },
      config,
    );
    const unit = storefrontUnitPriceMinor(breakdown, 97);
    // Off by at most a cent from qty rounding - never off by a setup fee.
    expect(Math.abs(unit * 97 - breakdown.totals.totalMinor)).toBeLessThanOrEqual(97);
  });

  it("also holds for embroidery, whose setup is a separate thread/run charge", () => {
    const breakdown = totalFor("embroidered");
    const unit = storefrontUnitPriceMinor(breakdown, 100);
    expect(breakdown.totals.setupMinor).toBeGreaterThan(0);
    expect(unit * 100).toBe(breakdown.totals.totalMinor);
  });

  it("returns 0 for a non-positive quantity instead of dividing by it", () => {
    const breakdown = totalFor("screen_print");
    expect(storefrontUnitPriceMinor(breakdown, 0)).toBe(0);
  });
});
