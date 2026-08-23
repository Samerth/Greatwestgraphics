import { describe, expect, it } from "vitest";
import { PRICING_MASTER_V2, garmentSellPerPieceMinor } from "@gwg/pricing";
import { shopperPriceSummary, shopperUnitMinor } from "./shopper-price";

describe("shopperUnitMinor", () => {
  it("uses the published blank-garment formula by default", () => {
    const unit = shopperUnitMinor(PRICING_MASTER_V2, {
      unitCostMinor: 800,
      quantity: 24,
    });
    expect(unit).toBe(
      garmentSellPerPieceMinor(PRICING_MASTER_V2, {
        unitCostMinor: 800,
        quantity: 24,
      }),
    );
  });

  it("exposes the same breakdown lines the admin preview uses", () => {
    const summary = shopperPriceSummary(
      {
        ...PRICING_MASTER_V2,
        storefront: {
          ...PRICING_MASTER_V2.storefront,
          unitPriceIncludes: "landed",
        },
      },
      {
        unitCostMinor: 800,
        quantity: 48,
        colourName: "White",
        methodKey: "screenPrint",
        colours: 1,
      },
    );
    expect(summary.costMinor).toBe(800);
    expect(summary.quantity).toBe(48);
    expect(summary.setupMinor).toBe(3500);
    expect(summary.threadMinor).toBe(0);
    expect(summary.unitMinor).toBeGreaterThan(summary.garmentMinor / 48);
  });
});
