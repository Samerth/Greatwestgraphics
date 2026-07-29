import { describe, expect, it } from "vitest";
import type { PricingConfig, QuoteInput } from "@gwg/contracts";
import {
  calculateQuote,
  DEFAULT_PRICING_CONFIG_V1,
  interpolateGarmentMarkup,
} from "../src/index.js";

const config: PricingConfig = structuredClone(DEFAULT_PRICING_CONFIG_V1);

function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    quantity: 24,
    garment: { unitCostMinor: 800, isDark: false },
    decorations: [
      {
        method: "screenPrint",
        location: "front",
        colours: 3,
        isOversized: false,
        isRepeatArtwork: false,
      },
    ],
    options: {
      rush: false,
      designHours: 0,
      includePacking: false,
      shippingCostMinor: 0,
    },
    needsArtworkReview: false,
    ...overrides,
  };
}

describe("calculateQuote acceptance tests", () => {
  it("Test A — screen print, light garment", () => {
    const result = calculateQuote(baseInput(), config);
    expect(result.garmentSellPerPieceMinor).toBe(1784);
    expect(result.decorationPerPieceMinor).toBe(730);
    expect(result.oneTimeFeesMinor).toBe(12000);
    expect(result.totalMinor).toBe(72336);
  });

  it("Test B — dark garment premium", () => {
    const result = calculateQuote(
      baseInput({ garment: { unitCostMinor: 800, isDark: true } }),
      config,
    );
    expect(result.decorationPerPieceMinor).toBe(840);
    expect(result.totalMinor).toBe(74976);
  });

  it("Test C — two locations", () => {
    const result = calculateQuote(
      baseInput({
        decorations: [
          {
            method: "screenPrint",
            location: "front",
            colours: 3,
            isOversized: false,
            isRepeatArtwork: false,
          },
          {
            method: "screenPrint",
            location: "back",
            colours: 2,
            isOversized: false,
            isRepeatArtwork: false,
          },
        ],
      }),
      config,
    );
    expect(result.decorationPerPieceMinor).toBe(730 + 610);
    expect(result.oneTimeFeesMinor).toBe(20000);
    expect(result.totalMinor).toBe(
      (1784 + 730 + 610) * 24 + 20000,
    );
  });

  it("Test D — embroidery over 5,000 stitches", () => {
    const result = calculateQuote(
      {
        quantity: 48,
        garment: { unitCostMinor: 500, isDark: false },
        decorations: [
          {
            method: "embroidery",
            location: "front",
            stitchCount: 8000,
            isOversized: false,
            isRepeatArtwork: false,
          },
        ],
        options: {
          rush: false,
          designHours: 0,
          includePacking: false,
          shippingCostMinor: 0,
        },
        needsArtworkReview: false,
      },
      config,
    );
    expect(result.decorationPerPieceMinor).toBe(880);
    expect(result.oneTimeFeesMinor).toBe(6500);
    const digitizing = result.lines.find((line) => line.kind === "digitizing");
    expect(digitizing?.extendedAmountMinor).toBe(6500);
  });

  it("Test E — repeat order", () => {
    const result = calculateQuote(
      baseInput({
        decorations: [
          {
            method: "screenPrint",
            location: "front",
            colours: 3,
            isOversized: false,
            isRepeatArtwork: true,
          },
        ],
      }),
      config,
    );
    expect(result.oneTimeFeesMinor).toBe(9000);
    expect(result.totalMinor).toBe((1784 + 730) * 24 + 9000);
  });

  it("Test F — screenPrint multiplier", () => {
    const scaled = structuredClone(config);
    scaled.multipliers.screenPrint = 1.1;
    const result = calculateQuote(baseInput(), scaled);
    expect(result.decorationPerPieceMinor).toBe(803);
    expect(result.garmentSellPerPieceMinor).toBe(1784);
  });

  it("Test H — rounding/caps", () => {
    const low = calculateQuote(
      baseInput({ garment: { unitCostMinor: 740, isDark: false } }),
      config,
    );
    expect(low.lines[0]?.meta).toMatchObject({ lookupCostDollars: 8 });
    expect(low.garmentSellPerPieceMinor).toBe(Math.round(740 * 2.23));

    const high = calculateQuote(
      baseInput({ garment: { unitCostMinor: 21000, isDark: false } }),
      config,
    );
    expect(high.lines[0]?.meta).toMatchObject({ lookupCostDollars: 150 });
  });
});

describe("garment markup interpolation", () => {
  // Reference pairs sampled from the Exact Quantity spreadsheet.
  const referencePairs = [
    { cost: 8, qty: 24, markup: 2.23 },
    { cost: 7, qty: 24, markup: 2.27 },
    { cost: 8, qty: 48, markup: 2.06 },
    { cost: 15, qty: 72, markup: 1.7 },
    { cost: 25, qty: 100, markup: 1.48 },
    { cost: 1, qty: 1, markup: 3.6 },
    { cost: 5, qty: 6, markup: 2.93 },
    { cost: 10, qty: 12, markup: 2.36 },
    { cost: 20, qty: 24, markup: 1.81 },
    { cost: 30, qty: 48, markup: 1.52 },
    { cost: 50, qty: 72, markup: 1.28 },
    { cost: 75, qty: 144, markup: 1.17 },
    { cost: 100, qty: 288, markup: 1.13 },
    { cost: 150, qty: 500, markup: 1.1 },
    { cost: 150, qty: 1000, markup: 1.08 },
    { cost: 3, qty: 10, markup: 2.87 },
    { cost: 12, qty: 30, markup: 2.02 },
    { cost: 18, qty: 60, markup: 1.69 },
    { cost: 40, qty: 90, markup: 1.33 },
    { cost: 65, qty: 200, markup: 1.18 },
    { cost: 85, qty: 400, markup: 1.12 },
    { cost: 120, qty: 750, markup: 1.09 },
    { cost: 2, qty: 5, markup: 3.24 },
    { cost: 9, qty: 15, markup: 2.35 },
    { cost: 22, qty: 36, markup: 1.71 },
  ];

  it("Test G — interpolated markup within ±0.02 of spreadsheet", () => {
    for (const pair of referencePairs) {
      const got = interpolateGarmentMarkup(
        config.garmentMarkup,
        pair.cost,
        pair.qty,
      );
      expect(
        Math.abs(got - pair.markup),
        `cost=${pair.cost} qty=${pair.qty} got=${got} expected=${pair.markup}`,
      ).toBeLessThanOrEqual(0.02 + 1e-9);
    }
  });
});
