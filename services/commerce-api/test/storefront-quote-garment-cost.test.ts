import { describe, expect, it, vi } from "vitest";
import type { CatalogService } from "../src/application/catalog-service.js";
import {
  pickCatalogHit,
  resolveGarmentCostMinor,
  storefrontCatalogLookup,
} from "../src/application/storefront-quote-garment-cost.js";

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

  it("a chat's vague 'gildan t-shirt' prices the best seller, not the first style number", async () => {
    const listProducts = vi.fn().mockResolvedValue([
      { id: "two-thousand", styleName: "2000", costMinor: 700 },
      { id: "five-thousand", styleName: "5000", costMinor: 650, isBestSeller: true },
    ]);
    const cost = await resolveGarmentCostMinor({
      tenantId: "t",
      sku: "gildan t-shirt",
      catalog: { listProducts, getProductDetail: vi.fn() },
    });
    expect(cost).toBe(650);
  });
});

/**
 * 17 Sep: CodChat now sends whatever the customer typed as `sku` - "5000",
 * "gildan 5000", "gildan t-shirt". The ranked search returns several
 * styles; these pin which one the quote is for.
 */
describe("pickCatalogHit", () => {
  const softstyle = { id: "softstyle", styleName: "64000", partNumber: "64000", isBestSeller: true };
  const heavyCotton = { id: "heavy", styleName: "5000", partNumber: "5000", isBestSeller: false };
  const ultraCotton = { id: "ultra", styleName: "2000", partNumber: "2000" };

  it("the whole sku as a style number beats a best seller ranked above it", () => {
    expect(pickCatalogHit("5000", [softstyle, heavyCotton])).toBe(heavyCotton);
    expect(pickCatalogHit(" 5000 ", [softstyle, heavyCotton])).toBe(heavyCotton);
  });

  it("matches a part number or external key too, case-insensitively", () => {
    const polo = { id: "polo", styleName: "K500", partNumber: "K500-BLK", externalKey: "sanmar:k500" };
    expect(pickCatalogHit("k500-blk", [softstyle, polo])).toBe(polo);
    expect(pickCatalogHit("SANMAR:K500", [softstyle, polo])).toBe(polo);
  });

  it("a style number inside a longer phrase still wins over a best seller", () => {
    expect(pickCatalogHit("gildan 5000", [softstyle, heavyCotton])).toBe(heavyCotton);
    expect(pickCatalogHit("5000 in black", [softstyle, heavyCotton])).toBe(heavyCotton);
  });

  it("with nothing named, the best seller beats the top-ranked hit", () => {
    expect(pickCatalogHit("gildan t-shirt", [ultraCotton, heavyCotton, softstyle])).toBe(softstyle);
  });

  it("falls back to the top-ranked hit when nothing is named and nothing is a best seller", () => {
    expect(pickCatalogHit("gildan t-shirt", [ultraCotton, heavyCotton])).toBe(ultraCotton);
  });

  it("returns undefined for no hits or a blank sku", () => {
    expect(pickCatalogHit("5000", [])).toBeUndefined();
    expect(pickCatalogHit("   ", [heavyCotton])).toBeUndefined();
  });
});

describe("storefrontCatalogLookup", () => {
  it("searches storefront-visible products grouped by style, and carries isBestSeller", async () => {
    const listProducts = vi.fn().mockResolvedValue([
      {
        id: "heavy",
        styleName: "5000",
        partNumber: "5000",
        externalKey: "sanmar:5000",
        costMinor: 650,
        isBestSeller: true,
        title: "Gildan Heavy Cotton Tee",
        brand: "Gildan",
      },
    ]);
    const getProductDetail = vi.fn().mockResolvedValue({ variants: [] });
    const lookup = storefrontCatalogLookup({
      listProducts,
      getProductDetail,
    } as unknown as Pick<CatalogService, "listProducts" | "getProductDetail">);

    const hits = await lookup.listProducts("t", { search: "5000", storeId: "s", limit: 10 });

    expect(listProducts).toHaveBeenCalledWith("t", {
      search: "5000",
      storeId: "s",
      limit: 10,
      storefrontOnly: true,
      groupByStyle: true,
    });
    expect(hits).toEqual([
      {
        id: "heavy",
        styleName: "5000",
        partNumber: "5000",
        externalKey: "sanmar:5000",
        costMinor: 650,
        isBestSeller: true,
      },
    ]);
  });

  it("forwards product detail with the store scope", async () => {
    const getProductDetail = vi.fn().mockResolvedValue({ variants: [{ customerPriceMinor: 900 }] });
    const lookup = storefrontCatalogLookup({
      listProducts: vi.fn(),
      getProductDetail,
    } as unknown as Pick<CatalogService, "listProducts" | "getProductDetail">);

    await lookup.getProductDetail("t", "heavy", { storeId: "s" });

    expect(getProductDetail).toHaveBeenCalledWith("t", "heavy", { storeId: "s" });
  });
});
