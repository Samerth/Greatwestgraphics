import { describe, expect, it } from "vitest";
import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import { PricingConfigV2Schema } from "@gwg/contracts";
import {
  calculateQuoteV2,
  interpolateByAnchor,
  PRICING_MASTER_V2,
  resolveIsDark,
} from "../src/index.js";

const config: PricingConfigV2 = structuredClone(PRICING_MASTER_V2);

function quote(overrides: Partial<QuoteInputV2> = {}): QuoteInputV2 {
  return {
    garments: [
      {
        id: "g1",
        description: "Tee",
        unitCostMinor: 800,
        quantity: 24,
        colourName: "White",
      },
    ],
    decorations: [],
    options: {
      rush: false,
      includePacking: false,
      shippingCostMinor: 0,
      designHours: 0,
    },
    ...overrides,
  } as QuoteInputV2;
}

describe("imported config", () => {
  it("matches the contract schema", () => {
    expect(() => PricingConfigV2Schema.parse(config)).not.toThrow();
  });

  it("keeps digitizing out of the embroidery multiplier", () => {
    const embroidery = config.methods.find((m) => m.key === "embroidery")!;
    expect(embroidery.multiplier).toBe(0.95);
    expect(embroidery.setup.newFeeMinor).toBe(6500);
    expect(embroidery.setup.multiplierApplies).toBe(false);
  });

  it("carries the client-directed fee changes", () => {
    const screen = config.methods.find((m) => m.key === "screenPrint")!;
    expect(screen.setup.newFeeMinor).toBe(3500);
    expect(screen.setup.repeatFeeMinor).toBe(3000);
    expect(
      screen.surcharges.find((s) => s.key === "darkGarment")?.value,
    ).toBeCloseTo(0.1);
    expect(config.settings.rushFeePercent).toBeCloseTo(0.3);
    expect(config.settings.rushAppliesTo).toBe("productionExcludingShipping");
    expect(
      config.methods.find((m) => m.key === "dtf")!.minimumChargePerLocationMinor,
    ).toBe(4000);
  });
});

describe("interpolation", () => {
  it("interpolates linearly between anchors", () => {
    const result = interpolateByAnchor([24, 48], [810, 660], 36);
    expect(result.value).toBeCloseTo(735);
    expect(result.fraction).toBeCloseTo(0.5);
  });

  it("stays flat at and above the top anchor", () => {
    const result = interpolateByAnchor([1, 288], [800, 300], 5000);
    expect(result.value).toBe(300);
    expect(result.isFlat).toBe(true);
  });

  it("matches the workbook's screen print rate for 100 dark pieces", () => {
    /**
     * The workbook keeps a second, pre-computed dark matrix (light x 1.1
     * rounded to the cent) and interpolates that, landing on $4.209444. We
     * hold one base matrix and apply the 10% premium as an editable surcharge,
     * which interpolates first and lands on $4.2075. The 0.2 cent gap is the
     * workbook's per-cell rounding, and one matrix is what makes the premium
     * an admin control instead of a duplicated table.
     */
    const screen = config.methods.find((m) => m.key === "screenPrint")!;
    if (screen.rateModel.kind !== "matrixByColour") throw new Error("wrong model");
    const light = interpolateByAnchor(
      screen.rateModel.qtyAnchors,
      screen.rateModel.ratesByColour["1"]!,
      100,
    );
    expect(light.value).toBeCloseTo(382.5, 4);
    const workbookDarkRate = 420.944;
    expect(Math.abs(light.value * 1.1 - workbookDarkRate) / workbookDarkRate).toBeLessThan(
      0.001,
    );
  });
});

describe("dark garment rule", () => {
  it("treats every colour except white as dark", () => {
    expect(resolveIsDark({ colourName: "White", isDark: undefined }, "everythingExceptWhite")).toBe(false);
    expect(resolveIsDark({ colourName: "Navy", isDark: undefined }, "everythingExceptWhite")).toBe(true);
    expect(resolveIsDark({ colourName: "Ash", isDark: undefined }, "everythingExceptWhite")).toBe(true);
  });

  it("honours an explicit override", () => {
    expect(resolveIsDark({ colourName: "Navy", isDark: false }, "everythingExceptWhite")).toBe(false);
  });
});

describe("workbook parity", () => {
  /**
   * The saved sample quote in "GWG Pricing Master Formula.xlsx": 100 dark
   * garments at $2.75 cost, front 1-colour screen print, new artwork.
   * Workbook: markup 2.03, garment $558.25, print $420.94, setup $30,
   * total before tax $1,009.19.
   *
   * Ours: $1,014.00. Setup is $35 because the client raised new-artwork setup,
   * and the rest is rounding — the workbook extends unrounded unit prices
   * ($5.5825 x 100), while we round the unit price first so a customer can
   * always multiply the printed unit price by the quantity and get the line
   * total. Total difference on this quote is 19 cents.
   */
  it("reproduces the sample quote line for line", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          {
            id: "g1",
            description: "Sample",
            unitCostMinor: 275,
            quantity: 100,
            colourName: "Navy",
          },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "west",
            colours: 1,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );

    const garment = result.lines.find((line) => line.kind === "garment")!;
    expect(garment.unitAmountMinor).toBe(558); // $2.75 x 2.03 markup
    expect(garment.extendedAmountMinor).toBe(55800);

    const print = result.lines.find((line) => line.kind === "decoration")!;
    expect(print.unitAmountMinor).toBe(383); // interpolated between 72 and 144
    const dark = result.lines.find((line) => line.kind === "surcharge")!;
    expect(dark.unitAmountMinor).toBe(38); // 10% dark premium
    expect(print.extendedAmountMinor + dark.extendedAmountMinor).toBe(42100);

    const setup = result.lines.find((line) => line.kind === "setup")!;
    expect(setup.extendedAmountMinor).toBe(3500);

    expect(result.totals.totalMinor).toBe(101400);
    // Within a rounding hair of the workbook's $1,009.19 + the $5 setup change.
    expect(Math.abs(result.totals.totalMinor - 101419)).toBeLessThanOrEqual(25);
  });
});

describe("decoration methods", () => {
  it("applies the DTF minimum on small runs and explains it", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Tee", unitCostMinor: 1000, quantity: 1, colourName: "White" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "dtf",
            location: "front",
            logoGroup: "",
            optionKey: "medium",
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );

    const dtf = result.lines.find((line) => line.kind === "decoration")!;
    expect(dtf.extendedAmountMinor).toBe(4000);
    expect(
      dtf.explain.steps.some((step) => step.label === "Minimum charge applied"),
    ).toBe(true);
  });

  it("does not apply the DTF minimum once the run clears it", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Tee", unitCostMinor: 1000, quantity: 24, colourName: "White" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "dtf",
            location: "front",
            logoGroup: "",
            optionKey: "medium",
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );
    // 24 pieces sits on the anchor: $6.25 each.
    expect(result.lines.find((line) => line.kind === "decoration")!.extendedAmountMinor).toBe(
      15000,
    );
  });

  it("bills partial thousands of stitches and never multiplies digitizing", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Cap", unitCostMinor: 500, quantity: 48, colourName: "Black" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "embroidery",
            location: "front",
            logoGroup: "acme",
            variableValue: 7500,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );

    // Base $6.25 + 2.5 x $0.85 = $8.375, x 0.95 multiplier = $7.95625,
    // rounded to $7.96 per piece.
    const run = result.lines.find((line) => line.kind === "decoration")!;
    expect(run.unitAmountMinor).toBe(796);
    expect(run.extendedAmountMinor).toBe(796 * 48);

    const digitizing = result.lines.find((line) => line.kind === "setup")!;
    expect(digitizing.extendedAmountMinor).toBe(6500);
  });

  it("waives digitizing only when staff verified the repeat", () => {
    const build = (verified: boolean) =>
      calculateQuoteV2(
        quote({
          garments: [
            { id: "g1", description: "Cap", unitCostMinor: 500, quantity: 48, colourName: "Black" },
          ],
          decorations: [
            {
              id: "d1",
              garmentId: "g1",
              methodKey: "embroidery",
              location: "front",
              logoGroup: "acme",
              variableValue: 5000,
              isOversized: false,
              artwork: {
                isRepeat: true,
                verifiedByStaff: verified,
                verifiedBy: verified ? "Kevin" : undefined,
              },
            },
          ],
        }),
        config,
      );

    const claimed = build(false);
    expect(claimed.totals.setupMinor).toBe(6500);
    expect(claimed.needsArtworkVerification).toBe(true);

    const verified = build(true);
    expect(verified.totals.setupMinor).toBe(0);
    expect(verified.needsArtworkVerification).toBe(false);
  });

  it("charges repeat screen setup only after verification", () => {
    const result = calculateQuoteV2(
      quote({
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "repeat-logo",
            colours: 3,
            isOversized: false,
            artwork: { isRepeat: true, verifiedByStaff: true, verifiedBy: "Kevin" },
          },
        ],
      }),
      config,
    );
    expect(result.totals.setupMinor).toBe(9000);
  });
});

describe("setup sharing", () => {
  it("splits one logo's setup across garments by quantity", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Tee", unitCostMinor: 800, quantity: 100, colourName: "White" },
          { id: "g2", description: "Hoodie", unitCostMinor: 2000, quantity: 50, colourName: "White" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "west",
            colours: 2,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
          {
            id: "d2",
            garmentId: "g2",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "west",
            colours: 2,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );

    // One logo, 2 colours x $35 = $70, split 100:50.
    const setups = result.lines.filter((line) => line.kind === "setup");
    expect(setups).toHaveLength(2);
    expect(setups.map((line) => line.extendedAmountMinor)).toEqual([4667, 2333]);
    expect(result.totals.setupMinor).toBe(7000);
  });

  it("charges separate setups when the logos differ", () => {
    const result = calculateQuoteV2(
      quote({
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "logo-a",
            colours: 1,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
          {
            id: "d2",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "back",
            logoGroup: "logo-b",
            colours: 1,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );
    expect(result.totals.setupMinor).toBe(7000);
  });
});

describe("order of operations", () => {
  it("excludes shipping from the rush base", () => {
    const result = calculateQuoteV2(
      quote({
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "",
            colours: 1,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
        options: {
          rush: true,
          includePacking: true,
          shippingCostMinor: 5000,
          designHours: 0,
        },
      }),
      config,
    );

    const { totals } = result;
    expect(totals.shippingMinor).toBe(5750);
    expect(totals.rushMinor).toBe(Math.round(totals.productionSubtotalMinor * 0.3));
    expect(totals.totalMinor).toBe(
      totals.productionSubtotalMinor + totals.shippingMinor + totals.rushMinor,
    );
  });

  it("adds the oversized surcharge per piece as its own line", () => {
    const result = calculateQuoteV2(
      quote({
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "",
            colours: 1,
            isOversized: true,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
      }),
      config,
    );
    const oversized = result.lines.find(
      (line) => line.kind === "surcharge" && line.label.startsWith("Oversized"),
    )!;
    expect(oversized.extendedAmountMinor).toBe(150 * 24);
  });

  it("keeps totals equal to the sum of its lines", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Tee", unitCostMinor: 800, quantity: 36, colourName: "Navy" },
          { id: "g2", description: "Hoodie", unitCostMinor: 2450, quantity: 12, colourName: "White" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "shared",
            colours: 3,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
          {
            id: "d2",
            garmentId: "g2",
            methodKey: "embroidery",
            location: "left chest",
            logoGroup: "",
            variableValue: 6200,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
          {
            id: "d3",
            garmentId: "g1",
            methodKey: "dtf",
            location: "sleeve",
            logoGroup: "",
            optionKey: "small",
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
        options: {
          rush: true,
          includePacking: true,
          shippingCostMinor: 4000,
          designHours: 0,
        },
      }),
      config,
    );

    const sum = result.lines.reduce((acc, line) => acc + line.extendedAmountMinor, 0);
    expect(sum).toBe(result.totals.totalMinor);
  });
});

describe("explanations", () => {
  it("gives every line plain English, steps, and a config source", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          { id: "g1", description: "Tee", unitCostMinor: 800, quantity: 36, colourName: "Navy" },
        ],
        decorations: [
          {
            id: "d1",
            garmentId: "g1",
            methodKey: "screenPrint",
            location: "front",
            logoGroup: "",
            colours: 3,
            isOversized: false,
            artwork: { isRepeat: false, verifiedByStaff: false },
          },
        ],
        options: {
          rush: true,
          includePacking: true,
          shippingCostMinor: 2000,
          designHours: 0,
        },
      }),
      config,
    );

    for (const line of result.lines) {
      expect(line.explain.plainEnglish.length).toBeGreaterThan(0);
      expect(line.explain.steps.length).toBeGreaterThan(0);
      expect(line.explain.sources.length).toBeGreaterThan(0);
    }

    // 36 pieces must show the interpolation between the 24 and 48 anchors.
    const print = result.lines.find((line) => line.kind === "decoration")!;
    expect(print.unitAmountMinor).toBe(735);
    expect(
      print.explain.steps.some((step) =>
        step.label === "Interpolated for exact quantity",
      ),
    ).toBe(true);
  });
});

describe("overrides", () => {
  it("lets staff override a garment price without touching the matrix", () => {
    const result = calculateQuoteV2(
      quote({
        garments: [
          {
            id: "g1",
            description: "Tee",
            unitCostMinor: 800,
            quantity: 24,
            colourName: "White",
            overrideSellPerPieceMinor: 1500,
            overrideReason: "Matched competitor",
          },
        ],
      }),
      config,
    );
    const garment = result.lines.find((line) => line.kind === "garment")!;
    expect(garment.unitAmountMinor).toBe(1500);
    expect(garment.isOverride).toBe(true);
    expect(
      garment.explain.steps.some((step) => step.label === "Staff override"),
    ).toBe(true);
  });

  it("warns when the whole quote total is overridden", () => {
    const result = calculateQuoteV2(
      quote({ options: { rush: false, includePacking: false, shippingCostMinor: 0, designHours: 0, overrideTotalMinor: 50000, overrideReason: "Contract price" } }),
      config,
    );
    expect(result.totals.totalMinor).toBe(50000);
    expect(result.warnings.some((w) => w.includes("overridden"))).toBe(true);
  });
});
