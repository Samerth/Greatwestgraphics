import { describe, expect, it } from "vitest";
import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import {
  StorefrontQuoteRequestSchema,
  StorefrontQuoteResponseSchema,
} from "@gwg/contracts";
import { calculateQuoteV2, PRICING_MASTER_V2 } from "@gwg/pricing";

const config = PRICING_MASTER_V2 as PricingConfigV2;

describe("StorefrontQuoteRequestSchema", () => {
  it("accepts minimal request with garment cost", () => {
    const input = {
      qty: 48,
      garment_cost_minor: 800,
    };
    const result = StorefrontQuoteRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qty).toBe(48);
      expect(result.data.garment_cost_minor).toBe(800);
      expect(result.data.decorations).toEqual([]);
      expect(result.data.rush).toBe(false);
    }
  });

  it("accepts request with decorations", () => {
    const input = {
      qty: 24,
      garment_cost_minor: 1000,
      decorations: [
        {
          method: "screenPrint",
          location: "front",
          colours: 2,
        },
        {
          method: "embroidery",
          location: "left chest",
          stitch_count: 8000,
        },
      ],
      rush: true,
    };
    const result = StorefrontQuoteRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decorations).toHaveLength(2);
      expect(result.data.rush).toBe(true);
    }
  });

  it("accepts request with product_id instead of garment cost", () => {
    const input = {
      qty: 12,
      product_id: "11111111-1111-4111-8111-111111111111",
    };
    const result = StorefrontQuoteRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.product_id).toBe("11111111-1111-4111-8111-111111111111");
      expect(result.data.garment_cost_minor).toBeUndefined();
    }
  });

  it("rejects request with invalid product_id", () => {
    const input = {
      qty: 12,
      product_id: "not-a-uuid",
    };
    const result = StorefrontQuoteRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("quote calculation for storefront endpoint", () => {
  it("calculates quote with screen print decoration", () => {
    const quoteInput: QuoteInputV2 = {
      garments: [
        {
          id: "g1",
          description: "Tee",
          unitCostMinor: 800,
          quantity: 48,
          colourName: "",
        },
      ],
      decorations: [
        {
          id: "d0",
          garmentId: "g1",
          methodKey: "screenPrint",
          location: "front",
          logoGroup: "",
          colours: 2,
          isOversized: false,
          artwork: { isRepeat: false, verifiedByStaff: false },
        },
      ],
      options: {
        rush: false,
        includePacking: false,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };

    const breakdown = calculateQuoteV2(quoteInput, config);
    expect(breakdown.totals.totalMinor).toBeGreaterThan(0);
    expect(breakdown.currency).toBe("CAD");
    expect(breakdown.garments[0]?.unitPriceMinor).toBeGreaterThan(0);
  });

  it("calculates quote with embroidery decoration", () => {
    const quoteInput: QuoteInputV2 = {
      garments: [
        {
          id: "g1",
          description: "Polo",
          unitCostMinor: 1500,
          quantity: 24,
          colourName: "",
        },
      ],
      decorations: [
        {
          id: "d0",
          garmentId: "g1",
          methodKey: "embroidery",
          location: "left chest",
          logoGroup: "",
          variableValue: 8000,
          isOversized: false,
          artwork: { isRepeat: false, verifiedByStaff: false },
        },
      ],
      options: {
        rush: false,
        includePacking: false,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };

    const breakdown = calculateQuoteV2(quoteInput, config);
    expect(breakdown.totals.totalMinor).toBeGreaterThan(0);
    expect(breakdown.totals.setupMinor).toBeGreaterThan(0);
  });

  it("applies rush fee when requested", () => {
    const baseInput: QuoteInputV2 = {
      garments: [
        {
          id: "g1",
          description: "Tee",
          unitCostMinor: 800,
          quantity: 48,
          colourName: "",
        },
      ],
      decorations: [
        {
          id: "d0",
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
        rush: false,
        includePacking: false,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };

    const rushInput: QuoteInputV2 = {
      ...baseInput,
      options: { ...baseInput.options, rush: true },
    };

    const normalBreakdown = calculateQuoteV2(baseInput, config);
    const rushBreakdown = calculateQuoteV2(rushInput, config);

    expect(rushBreakdown.totals.rushMinor).toBeGreaterThan(0);
    expect(rushBreakdown.totals.totalMinor).toBeGreaterThan(
      normalBreakdown.totals.totalMinor,
    );
  });
});

describe("StorefrontQuoteResponseSchema", () => {
  it("validates correct response shape", () => {
    const response = {
      unit_price: 15.75,
      total: 756.0,
      turnaround_days: 10,
      currency: "CAD",
      breakdown: {
        garment_per_piece: 12.0,
        decoration_per_piece: 3.75,
        setup_total: 45.0,
        rush_total: 0,
      },
    };

    const result = StorefrontQuoteResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit_price).toBe(15.75);
      expect(result.data.total).toBe(756.0);
      expect(result.data.turnaround_days).toBe(10);
      expect(result.data.currency).toBe("CAD");
    }
  });

  it("allows response without breakdown", () => {
    const response = {
      unit_price: 15.75,
      total: 756.0,
      turnaround_days: 10,
      currency: "CAD",
    };

    const result = StorefrontQuoteResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.breakdown).toBeUndefined();
    }
  });
});
