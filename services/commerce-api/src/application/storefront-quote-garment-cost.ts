/**
 * Resolve garment cost for Cod Chat /pricing/quote when the connector sends
 * a style code in `sku` instead of a colourway UUID.
 */
export type CatalogProductHit = {
  id: string;
  styleName?: string | null;
  partNumber?: string | null;
  externalKey?: string | null;
  costMinor?: number | null;
};

export type CatalogSkuLookup = {
  listProducts: (
    tenantId: string,
    query: { search: string; storeId?: string; limit?: number },
  ) => Promise<CatalogProductHit[]>;
  getProductDetail: (
    tenantId: string,
    productId: string,
    opts: { storeId?: string },
  ) => Promise<{ variants: Array<{ customerPriceMinor: number }> }>;
};

export async function resolveGarmentCostMinor(input: {
  tenantId: string;
  storeId?: string;
  productId?: string;
  sku?: string;
  garmentCostMinor?: number;
  catalog: CatalogSkuLookup;
}): Promise<number | undefined> {
  let garmentCostMinor = input.garmentCostMinor;

  if (garmentCostMinor === undefined && input.productId) {
    const detail = await input.catalog.getProductDetail(
      input.tenantId,
      input.productId,
      { storeId: input.storeId },
    );
    const firstVariant = detail.variants[0];
    if (firstVariant) {
      garmentCostMinor = firstVariant.customerPriceMinor;
    }
  }

  if (garmentCostMinor === undefined && input.sku) {
    const matches = await input.catalog.listProducts(input.tenantId, {
      search: input.sku,
      storeId: input.storeId,
      limit: 10,
    });
    const skuLower = input.sku.trim().toLowerCase();
    const exact =
      matches.find(
        (row) =>
          row.styleName?.toLowerCase() === skuLower ||
          row.partNumber?.toLowerCase() === skuLower ||
          row.externalKey?.toLowerCase() === skuLower,
      ) ?? matches[0];
    if (exact?.costMinor != null && exact.costMinor >= 0) {
      garmentCostMinor = exact.costMinor;
    } else if (exact?.id) {
      const detail = await input.catalog.getProductDetail(
        input.tenantId,
        exact.id,
        { storeId: input.storeId },
      );
      const firstVariant = detail.variants[0];
      if (firstVariant) {
        garmentCostMinor = firstVariant.customerPriceMinor;
      }
    }
  }

  return garmentCostMinor;
}
