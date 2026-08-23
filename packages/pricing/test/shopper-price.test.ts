import { describe, expect, it } from "vitest";
import type { PricingConfigV2 } from "@gwg/contracts";
import {
  calculateQuoteV2,
  garmentSellPerPieceMinor,
  PRICING_MASTER_V2,
  priceShopperItem,
  priceShopperQuote,
} from "../src/index.js";

const config: PricingConfigV2 = structuredClone(PRICING_MASTER_V2);

describe("priceShopperItem", () => {
  it("matches the quote engine garment price in blank mode", () => {
    const { summary } = priceShopperItem(config, {
      unitCostMinor: 800,
      quantity: 48,
    });
    expect(summary.unitMinor).toBe(
      garmentSellPerPieceMinor(config, { unitCostMinor: 800, quantity: 48 }),
    );
    expect(summary.decorationMinor).toBe(0);
    expect(summary.setupMinor).toBe(0);
  });

  it("includes decoration but not setup when the storefront strategy is decorated", () => {
    const decorated: PricingConfigV2 = {
      ...structuredClone(config),
      storefront: { ...config.storefront, unitPriceIncludes: "decorated" },
    };
    const { summary, breakdown } = priceShopperItem(decorated, {
      unitCostMinor: 800,
      quantity: 48,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 1,
    });
    expect(summary.setupMinor).toBeGreaterThan(0);
    expect(summary.decorationMinor).toBeGreaterThan(0);
    expect(summary.totalMinor).toBe(
      summary.garmentMinor + summary.decorationMinor,
    );
    expect(summary.unitMinor * summary.quantity).toBe(summary.totalMinor);
    expect(breakdown.totals.totalMinor).toBeGreaterThan(summary.totalMinor);
  });

  it("amortizes setup into the unit price in landed mode", () => {
    const landed: PricingConfigV2 = {
      ...structuredClone(config),
      storefront: { ...config.storefront, unitPriceIncludes: "landed" },
    };
    const { summary } = priceShopperItem(landed, {
      unitCostMinor: 800,
      quantity: 48,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 1,
    });
    expect(summary.setupMinor).toBe(3500);
    expect(summary.totalMinor).toBe(
      summary.garmentMinor + summary.decorationMinor + summary.setupMinor,
    );
  });

  it("uses the same quote math the admin calculator uses", () => {
    const landed: PricingConfigV2 = {
      ...structuredClone(config),
      storefront: { ...config.storefront, unitPriceIncludes: "landed" },
    };
    const { summary, breakdown } = priceShopperItem(landed, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "dtf",
      optionKey: "medium",
    });
    const admin = calculateQuoteV2(
      {
        garments: [
          {
            id: "shopper",
            description: "Shopper price",
            unitCostMinor: 800,
            quantity: 24,
            colourName: "White",
          },
        ],
        decorations: [
          {
            id: "shopper",
            garmentId: "shopper",
            methodKey: "dtf",
            location: "front",
            logoGroup: "",
            optionKey: "medium",
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
        options: {
          rush: false,
          includePacking: false,
          shippingCostMinor: 0,
          designHours: 0,
        },
      },
      landed,
    );
    expect(breakdown.totals.merchandiseMinor).toBe(admin.totals.merchandiseMinor);
    expect(breakdown.totals.decorationMinor).toBe(admin.totals.decorationMinor);
    expect(summary.garmentMinor).toBe(admin.totals.merchandiseMinor);
  });
});

describe("priceShopperQuote", () => {
  it("matches admin preview totals for the same screen-print inputs", () => {
    const priced = priceShopperQuote(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 3,
      locations: ["front"],
    });
    const admin = calculateQuoteV2(priced.input, config);
    expect(priced.totalMinor).toBe(admin.totals.totalMinor);
    expect(priced.breakdown.totals.setupMinor).toBe(10500);
    expect(priced.cartUnit * priced.breakdown.totalQuantity).toBeCloseTo(
      priced.totalMinor / 100,
      10,
    );
  });

  it("prices embroidery stitches and DTF options through the same engine", () => {
    const embroidery = priceShopperQuote(config, {
      unitCostMinor: 500,
      quantity: 48,
      colourName: "Black",
      methodKey: "embroidery",
      stitchCount: 8000,
      locations: ["front"],
    });
    expect(embroidery.breakdown.lines.some((line) => line.kind === "setup")).toBe(
      true,
    );
    expect(embroidery.totalMinor).toBe(
      calculateQuoteV2(embroidery.input, config).totals.totalMinor,
    );

    const dtf = priceShopperQuote(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "dtf",
      optionKey: "medium",
      locations: ["front"],
    });
    expect(dtf.totalMinor).toBe(
      calculateQuoteV2(dtf.input, config).totals.totalMinor,
    );
  });

  it("shares one setup fee when placements use the same design", () => {
    const shared = priceShopperQuote(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 1,
      locations: ["front", "back"],
      shareSetup: true,
    });
    expect(shared.breakdown.totals.setupMinor).toBe(3500);
  });

  it("charges setup per placement when artwork is independent", () => {
    const independent = priceShopperQuote(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 1,
      locations: ["front", "back"],
      shareSetup: false,
    });
    const setupTotal = independent.breakdown.lines
      .filter((line) => line.kind === "setup")
      .reduce((sum, line) => sum + line.extendedAmountMinor, 0);
    expect(setupTotal).toBe(7000);
  });
});
