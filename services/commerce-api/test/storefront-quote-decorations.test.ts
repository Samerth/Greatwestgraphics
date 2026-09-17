import { describe, expect, it } from "vitest";
import type { PricingConfigV2 } from "@gwg/contracts";
import { calculateQuoteV2, PRICING_MASTER_V2 } from "@gwg/pricing";
import {
  buildStorefrontDecorations,
  normalizeStorefrontDecorations,
  resolveDecorationMethodKey,
  STOREFRONT_GARMENT_ID,
  UnsupportedDecorationMethodError,
} from "../src/application/storefront-quote-decorations.js";

/**
 * 17 Sep: CodChat's estimate tool sends what a customer said, which is
 * rarely what the pricing engine demands. "screen_print" with no colour
 * count, "dtg" with no size, "embroidered" with no stitch count all came
 * back as HTTP 500. These pin the translation layer that turns each of
 * those into a priced quote, and a genuinely unpriceable method into a
 * 400 that says what can be priced.
 */
const storefront = {
  defaultColours: 1,
  defaultStitchCount: 5000,
  defaultOptionKey: "medium",
};

describe("resolveDecorationMethodKey", () => {
  it("maps every spelling of screen print to screenPrint", () => {
    for (const spelling of [
      "screenPrint",
      "screen_print",
      "screenprint",
      "screen-print",
      "Screen Print",
      "SCREENPRINT",
      " screen print ",
    ]) {
      expect(resolveDecorationMethodKey(spelling), spelling).toBe("screenPrint");
    }
  });

  it("maps the full-colour family to dtf", () => {
    for (const spelling of [
      "dtf",
      "DTF",
      "dtg",
      "DTG",
      "digitalPrint",
      "digital_print",
      "heatTransfer",
      "heat_transfer",
      "heat transfer",
      "vinyl",
      "directToFilm",
      "direct_to_film",
      "direct to garment",
    ]) {
      expect(resolveDecorationMethodKey(spelling), spelling).toBe("dtf");
    }
  });

  it("maps embroider* to embroidery", () => {
    for (const spelling of ["embroidery", "Embroidery", "embroidered", "embroider"]) {
      expect(resolveDecorationMethodKey(spelling), spelling).toBe("embroidery");
    }
  });

  it("returns null for what the shop cannot price", () => {
    for (const spelling of [
      "sublimation",
      "laserEngrave",
      "laser_engrave",
      "patches",
      "glitter",
      "",
      "   ",
    ]) {
      expect(resolveDecorationMethodKey(spelling), JSON.stringify(spelling)).toBeNull();
    }
  });
});

describe("normalizeStorefrontDecorations", () => {
  it("refuses an unpriceable method, naming what is priceable", () => {
    let caught: unknown;
    try {
      normalizeStorefrontDecorations([
        { method: "sublimation", location: "front", is_oversized: false },
      ]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnsupportedDecorationMethodError);
    const error = caught as UnsupportedDecorationMethodError;
    expect(error.code).toBe("UNSUPPORTED_DECORATION_METHOD");
    expect(error.message).toContain('"sublimation"');
    expect(error.message).toContain("screen print, embroidery or DTF");
  });

  it("keeps everything but the method untouched", () => {
    const [line] = normalizeStorefrontDecorations([
      {
        method: "screen_print",
        location: "left_chest",
        colours: 3,
        stitch_count: 7000,
        option_key: "Large",
        is_oversized: true,
      },
    ]);
    expect(line).toEqual({
      method: "screenPrint",
      location: "left_chest",
      colours: 3,
      stitch_count: 7000,
      option_key: "Large",
      is_oversized: true,
    });
  });
});

describe("buildStorefrontDecorations", () => {
  const normalized = (method: string, extra: Record<string, unknown> = {}) =>
    normalizeStorefrontDecorations([
      { method, location: "front", is_oversized: false, ...extra },
    ]);

  it("screen print with no colour count prices as one colour", () => {
    const [line] = buildStorefrontDecorations(normalized("screen_print"), storefront);
    expect(line!.colours).toBe(1);
    expect(line!.variableValue).toBeUndefined();
    expect(line!.optionKey).toBeUndefined();
  });

  it("a stated colour count is kept", () => {
    const [line] = buildStorefrontDecorations(
      normalized("screen_print", { colours: 3 }),
      storefront,
    );
    expect(line!.colours).toBe(3);
  });

  it("embroidery with no stitch count uses the included 5000", () => {
    const [line] = buildStorefrontDecorations(normalized("embroidered"), storefront);
    expect(line!.variableValue).toBe(5000);
    expect(line!.colours).toBeUndefined();
  });

  it("dtf with no size uses medium, and a stated size is lower-cased", () => {
    const [plain] = buildStorefrontDecorations(normalized("dtg"), storefront);
    expect(plain!.optionKey).toBe("medium");
    const [stated] = buildStorefrontDecorations(
      normalized("dtf", { option_key: "Large" }),
      storefront,
    );
    expect(stated!.optionKey).toBe("large");
  });

  it("reads the defaults from the config, not from the code", () => {
    const [line] = buildStorefrontDecorations(normalized("screen_print"), {
      ...storefront,
      defaultColours: 2,
    });
    expect(line!.colours).toBe(2);
  });

  it("produces the engine's line shape", () => {
    const lines = buildStorefrontDecorations(
      normalizeStorefrontDecorations([
        { method: "screenPrint", location: "front", is_oversized: false },
        { method: "embroidery", location: "back", is_oversized: true },
      ]),
      storefront,
    );
    expect(lines[0]).toMatchObject({
      id: "d0",
      garmentId: STOREFRONT_GARMENT_ID,
      logoGroup: "",
      isOversized: false,
      artwork: { isRepeat: false, verifiedByStaff: false },
    });
    expect(lines[1]).toMatchObject({ id: "d1", isOversized: true });
  });

  it("a chat-collected request with no detail prices end to end", () => {
    const config = PRICING_MASTER_V2 as PricingConfigV2;
    for (const method of ["screen_print", "dtg", "embroidered"]) {
      const decorations = buildStorefrontDecorations(
        normalized(method),
        config.storefront,
      );
      const breakdown = calculateQuoteV2(
        {
          garments: [
            {
              id: STOREFRONT_GARMENT_ID,
              description: "test",
              unitCostMinor: 800,
              quantity: 24,
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
      expect(breakdown.totals.totalMinor, method).toBeGreaterThan(0);
    }
  });
});
