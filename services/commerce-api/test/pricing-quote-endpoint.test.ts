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

  it("accepts sku-only body for Cod Chat estimate mapper (cost resolved server-side)", () => {
    const input = {
      qty: 5,
      sku: "A230",
      decorations: [
        { method: "screenPrint", location: "front", colours: 1 },
      ],
    };
    const result = StorefrontQuoteRequestSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe("A230");
      expect(result.data.product_id).toBeUndefined();
      expect(result.data.garment_cost_minor).toBeUndefined();
    }
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

describe("resolveGarmentCostMinor wiring", () => {
  it("accepts sku-only request when catalog lookup returns cost", async () => {
    const { resolveGarmentCostMinor } = await import(
      "../src/application/storefront-quote-garment-cost.js"
    );

    const catalogWithA230 = {
      listProducts: async () => [
        {
          id: "6adbf644-9a1a-4005-b24b-4772a39920a2",
          styleName: "A230",
          partNumber: "81053",
          costMinor: 3150,
        },
      ],
      getProductDetail: async () => ({
        variants: [{ customerPriceMinor: 3150 }],
      }),
    };

    const cost = await resolveGarmentCostMinor({
      tenantId: "tenant-1",
      sku: "A230",
      catalog: catalogWithA230,
    });
    expect(cost).toBe(3150);
  });

  it("returns undefined for sku with no catalog match", async () => {
    const { resolveGarmentCostMinor } = await import(
      "../src/application/storefront-quote-garment-cost.js"
    );

    const emptyCatalog = {
      listProducts: async () => [],
      getProductDetail: async () => ({ variants: [] }),
    };

    const cost = await resolveGarmentCostMinor({
      tenantId: "tenant-1",
      sku: "NONEXISTENT",
      catalog: emptyCatalog,
    });
    expect(cost).toBeUndefined();
  });

  it("prefers explicit garment_cost_minor over sku lookup", async () => {
    const { resolveGarmentCostMinor } = await import(
      "../src/application/storefront-quote-garment-cost.js"
    );

    const catalogWithA230 = {
      listProducts: async () => [
        { id: "uuid", styleName: "A230", costMinor: 3150 },
      ],
      getProductDetail: async () => ({
        variants: [{ customerPriceMinor: 3150 }],
      }),
    };

    const cost = await resolveGarmentCostMinor({
      tenantId: "tenant-1",
      sku: "A230",
      garmentCostMinor: 5000,
      catalog: catalogWithA230,
    });
    expect(cost).toBe(5000);
  });

  it("prefers product_id lookup over sku lookup", async () => {
    const { resolveGarmentCostMinor } = await import(
      "../src/application/storefront-quote-garment-cost.js"
    );

    const catalog = {
      listProducts: async () => [
        { id: "sku-uuid", styleName: "A230", costMinor: 3150 },
      ],
      getProductDetail: async () => ({
        variants: [{ customerPriceMinor: 4200 }],
      }),
    };

    const cost = await resolveGarmentCostMinor({
      tenantId: "tenant-1",
      productId: "product-uuid",
      sku: "A230",
      catalog: catalog,
    });
    expect(cost).toBe(4200);
  });
});

describe("the turnaround a quote promises", () => {
  it("is the published 5-7 business days, not the old 10", () => {
    // The 10 Sep CodChat test found four different turnaround figures across
    // the site; the chat's pricing tool was the one saying 10. The client
    // confirmed 5-7 on 13 Sep, and the quote promises the upper bound.
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const app = readFileSync(resolve(process.cwd(), "src/app.ts"), "utf8");
    expect(app).toContain("const standardTurnaroundDays = 7;");
    expect(app).not.toContain("const standardTurnaroundDays = 10;");
  });
});
