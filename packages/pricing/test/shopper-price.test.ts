import { describe, expect, it } from "vitest";
import type { PricingConfigV2 } from "@gwg/contracts";
import {
  calculateQuoteV2,
  garmentSellPerPieceMinor,
  PRICING_MASTER_V2,
  priceShopperItem,
  priceShopperQuote,
  priceShopperQuoteMulti,
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
    expect(summary.setupMinor).toBe(3000);
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
    expect(priced.breakdown.totals.setupMinor).toBe(9000);
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
    expect(shared.breakdown.totals.setupMinor).toBe(3000);
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
    expect(setupTotal).toBe(6000);
  });
});

describe("priceShopperQuoteMulti", () => {
  // The Design Studio needs this: one design that runs Screen Print on the
  // front and Embroidery on a sleeve, each priced through its own method —
  // priceShopperQuote can only apply one method to every location (CodSphere
  // UAT: "a customer could select Screen Print → Front → 3 Colours for one
  // logo and Embroidery → Left Chest → Small for another").
  it("prices each location through its own method, matching a hand-built multi-line quote", () => {
    const multi = priceShopperQuoteMulti(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      description: "Team hoodie",
      decorations: [
        { location: "front", methodKey: "screenPrint", colours: 2 },
        { location: "left", methodKey: "embroidery", stitchCount: 8000 },
      ],
    });

    const admin = calculateQuoteV2(
      {
        garments: [
          {
            id: "shopper",
            description: "Team hoodie",
            unitCostMinor: 800,
            quantity: 24,
            colourName: "White",
          },
        ],
        decorations: [
          {
            id: "decoration-front",
            garmentId: "shopper",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "",
            colours: 2,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
          {
            id: "decoration-left",
            garmentId: "shopper",
            methodKey: "embroidery",
            location: "left",
            logoGroup: "",
            variableValue: 8000,
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
      config,
    );

    expect(multi.totalMinor).toBe(admin.totals.totalMinor);
    expect(multi.input.decorations).toHaveLength(2);
    expect(multi.input.decorations[0]?.methodKey).toBe("screenPrint");
    expect(multi.input.decorations[1]?.methodKey).toBe("embroidery");
  });

  it("charges more than a single-method quote for the same two placements, since each now carries its own decoration cost", () => {
    const singleMethodBothPlacements = priceShopperQuote(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      methodKey: "screenPrint",
      colours: 2,
      locations: ["front", "left"],
    });
    const mixed = priceShopperQuoteMulti(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      decorations: [
        { location: "front", methodKey: "screenPrint", colours: 2 },
        { location: "left", methodKey: "embroidery", stitchCount: 8000 },
      ],
    });
    // Not asserting an exact number (that's the admin-comparison test's
    // job) — just that swapping one placement to a different, real method
    // actually changed the price rather than being silently ignored.
    expect(mixed.totalMinor).not.toBe(singleMethodBothPlacements.totalMinor);
  });

  it("drops a location whose method key does not match any enabled method, rather than throwing", () => {
    const priced = priceShopperQuoteMulti(config, {
      unitCostMinor: 800,
      quantity: 24,
      colourName: "White",
      decorations: [
        { location: "front", methodKey: "screenPrint", colours: 1 },
        { location: "back", methodKey: "not-a-real-method" },
      ],
    });
    expect(priced.input.decorations).toHaveLength(1);
    expect(priced.input.decorations[0]?.location).toBe("front");
  });
});

describe("individual names and numbers", () => {
  // Regression guard: the fee was defined in config and shown in the UI but
  // never actually applied, because no storefront caller passed the flag.
  const withFee: PricingConfigV2 = {
    ...structuredClone(config),
    settings: {
      ...structuredClone(config).settings,
      namesNumbersFeePerGarmentMinor: 750,
    },
  };

  const base = {
    unitCostMinor: 800,
    quantity: 20,
    decorated: true,
    description: "Team hoodie",
  } as const;

  it("charges nothing extra when the flag is off", () => {
    const off = priceShopperQuote(withFee, base);
    const explicitlyOff = priceShopperQuote(withFee, {
      ...base,
      includeNamesNumbers: false,
    });
    expect(explicitlyOff.totalMinor).toBe(off.totalMinor);
  });

  it("adds the configured fee for every piece when the flag is on", () => {
    const off = priceShopperQuote(withFee, base);
    const on = priceShopperQuote(withFee, {
      ...base,
      includeNamesNumbers: true,
    });
    expect(on.totalMinor - off.totalMinor).toBe(750 * base.quantity);
  });

  it("adds nothing when the configured fee is zero, flag or not", () => {
    const free: PricingConfigV2 = {
      ...structuredClone(config),
      settings: {
        ...structuredClone(config).settings,
        namesNumbersFeePerGarmentMinor: 0,
      },
    };
    const off = priceShopperQuote(free, base);
    const on = priceShopperQuote(free, { ...base, includeNamesNumbers: true });
    expect(on.totalMinor).toBe(off.totalMinor);
  });
});
