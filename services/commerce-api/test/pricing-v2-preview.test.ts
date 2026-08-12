import { describe, expect, it } from "vitest";
import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import type { CommerceDatabase } from "../src/db/client.js";
import { PricingConfigV2Service } from "../src/application/pricing-config-v2-service.js";

/**
 * Inline selectors never touch the database, so the comparison math can be
 * exercised without a live Postgres.
 */
const noDatabase = {} as CommerceDatabase;

const context = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  storeId: "33333333-3333-4333-8333-333333333333",
};

const quote: QuoteInputV2 = {
  garments: [
    {
      id: "g1",
      description: "Tee",
      unitCostMinor: 800,
      quantity: 48,
      colourName: "Black",
    },
  ],
  decorations: [
    {
      id: "d1",
      garmentId: "g1",
      methodKey: "screenPrint",
      location: "Full front",
      logoGroup: "",
      colours: 2,
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
};

function withGarmentMultiplier(multiplier: number): PricingConfigV2 {
  return {
    ...structuredClone(PRICING_MASTER_V2),
    garment: { ...structuredClone(PRICING_MASTER_V2.garment), multiplier },
  };
}

describe("PricingConfigV2Service.preview", () => {
  const service = new PricingConfigV2Service(noDatabase);

  it("prices an inline config without persisting anything", async () => {
    const result = await service.preview({
      context,
      using: { kind: "inline", config: PRICING_MASTER_V2 },
      quote,
    });

    expect(result.using.label).toBe("Unsaved changes");
    expect(result.using.breakdown.totals.totalMinor).toBeGreaterThan(0);
    expect(result.comparison).toBeNull();
    expect(result.differences).toEqual([]);
  });

  it("reports the delta between two configs", async () => {
    const result = await service.preview({
      context,
      using: { kind: "inline", config: withGarmentMultiplier(1.1) },
      compareWith: { kind: "inline", config: withGarmentMultiplier(1) },
      quote,
    });

    const garments = result.differences.find((row) => row.label === "Garments");
    const total = result.differences.find((row) => row.label === "Total");

    expect(garments?.deltaMinor).toBeGreaterThan(0);
    expect(garments?.usingMinor).toBe(
      result.using.breakdown.totals.merchandiseMinor,
    );
    expect(total?.deltaMinor).toBe(
      result.using.breakdown.totals.totalMinor -
        result.comparison!.breakdown.totals.totalMinor,
    );
  });

  it("leaves decoration untouched when only garment pricing moves", async () => {
    const result = await service.preview({
      context,
      using: { kind: "inline", config: withGarmentMultiplier(1.25) },
      compareWith: { kind: "inline", config: withGarmentMultiplier(1) },
      quote,
    });

    const decoration = result.differences.find(
      (row) => row.label === "Decoration",
    );
    expect(decoration?.deltaMinor).toBe(0);
  });
});
