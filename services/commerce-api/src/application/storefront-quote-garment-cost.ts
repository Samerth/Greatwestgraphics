import type { CatalogService } from "./catalog-service.js";

/**
 * Resolve garment cost for Cod Chat /pricing/quote when the connector sends
 * a style code - or, since 17 Sep, whatever the customer typed - in `sku`
 * instead of a colourway UUID.
 */
export type CatalogProductHit = {
  id: string;
  styleName?: string | null;
  partNumber?: string | null;
  externalKey?: string | null;
  costMinor?: number | null;
  /** Real Best Sellers category membership, set by staff in the admin. */
  isBestSeller?: boolean | null;
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

function identifiers(hit: CatalogProductHit): string[] {
  return [hit.styleName, hit.partNumber, hit.externalKey]
    .filter((value): value is string => typeof value === "string" && value !== "")
    .map((value) => value.toLowerCase());
}

/**
 * Which catalogue hit a `sku` string means, from the ranked search results.
 *
 * 1. The whole string is a style number or part number - "5000", "G500".
 * 2. A word inside it is - "gildan 5000", "5000 in black" - so a best seller
 *    with a different number cannot steal a request that named one.
 * 3. Nothing was named, so the best seller among the hits - "gildan
 *    t-shirt" from a chat should price the shirt the shop actually sells
 *    most, not whichever style number sorts first.
 * 4. The top-ranked hit.
 */
export function pickCatalogHit(
  sku: string,
  hits: readonly CatalogProductHit[],
): CatalogProductHit | undefined {
  const whole = sku.trim().toLowerCase();
  if (!whole || hits.length === 0) return undefined;

  const exact = hits.find((hit) => identifiers(hit).includes(whole));
  if (exact) return exact;

  const terms = whole.split(/\s+/).filter((term) => term.length >= 2);
  const named = hits.find((hit) => {
    const ids = identifiers(hit);
    return terms.some((term) => ids.includes(term));
  });
  if (named) return named;

  return hits.find((hit) => hit.isBestSeller === true) ?? hits[0];
}

/**
 * The catalogue as the quote endpoint sees it.
 *
 * Storefront-visible only: a soft-hidden colourway or a feed-noise "brand"
 * (SanMar's "Unknown" placeholders) must never win a chat's "gildan".
 * Grouped by style: ungrouped, ten hits are ten colourways of the one style
 * that sorts first, and a best-seller tie-break could never reach a
 * different style.
 */
export function storefrontCatalogLookup(
  catalog: Pick<CatalogService, "listProducts" | "getProductDetail">,
): CatalogSkuLookup {
  return {
    listProducts: async (tenantId, query) => {
      const products = await catalog.listProducts(tenantId, {
        search: query.search,
        storeId: query.storeId,
        limit: query.limit,
        storefrontOnly: true,
        groupByStyle: true,
      });
      return products.map((product) => ({
        id: product.id,
        styleName: product.styleName,
        partNumber: product.partNumber,
        externalKey: product.externalKey,
        costMinor: product.costMinor,
        isBestSeller: product.isBestSeller,
      }));
    },
    getProductDetail: (tenantId, productId, opts) =>
      catalog.getProductDetail(tenantId, productId, { storeId: opts.storeId }),
  };
}

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
    const exact = pickCatalogHit(input.sku, matches);
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
