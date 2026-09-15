import { describe, expect, it, vi } from "vitest";
import { resolveGarmentCostMinor } from "../src/application/storefront-quote-garment-cost.js";

describe("resolveGarmentCostMinor", () => {
  it("returns explicit garment_cost_minor", async () => {
    const cost = await resolveGarmentCostMinor({
      tenantId: "t",
      garmentCostMinor: 3150,
      catalog: {
        listProducts: vi.fn(),
        getProductDetail: vi.fn(),
      },
    });
    expect(cost).toBe(3150);
  });

  it("looks up cost by product_id", async () => {
    const getProductDetail = vi.fn().mockResolvedValue({
      variants: [{ customerPriceMinor: 4200 }],
    });
    const cost = await resolveGarmentCostMinor({
      tenantId: "t",
      productId: "6adbf644-9a1a-4005-b24b-4772a39920a2",
      catalog: { listProducts: vi.fn(), getProductDetail },
    });
    expect(cost).toBe(4200);
    expect(getProductDetail).toHaveBeenCalledOnce();
  });

  it("resolves sku via exact styleName catalog hit", async () => {
    const listProducts = vi.fn().mockResolvedValue([
      {
        id: "6adbf644-9a1a-4005-b24b-4772a39920a2",
        styleName: "A230",
        partNumber: "81053",
        costMinor: 3150,
      },
    ]);
    const cost = await resolveGarmentCostMinor({
      tenantId: "t",
      sku: "A230",
      catalog: { listProducts, getProductDetail: vi.fn() },
    });
    expect(cost).toBe(3150);
    expect(listProducts).toHaveBeenCalledWith("t", {
      search: "A230",
      storeId: undefined,
      limit: 10,
    });
  });

  it("returns undefined when sku has no catalog hit", async () => {
    const cost = await resolveGarmentCostMinor({
      tenantId: "t",
      sku: "NOPE",
      catalog: {
        listProducts: vi.fn().mockResolvedValue([]),
        getProductDetail: vi.fn(),
      },
    });
    expect(cost).toBeUndefined();
  });
});
