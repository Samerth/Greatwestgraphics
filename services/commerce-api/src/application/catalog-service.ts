import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import {
  catalogSettings,
  categories,
  categoryOverrides,
  ssCategoryMap,
  ssProductCategories,
  ssProducts,
  ssStyles,
  ssUnmappedCategories,
  ssVariants,
  storeCategoryVisibility,
  syncRuns,
} from "../db/schema.js";
import { retailFromCost } from "../adapters/ss-activewear/client.js";
import {
  DataIntegrityError,
  ResourceNotFoundError,
} from "./job-request-service.js";

type ProductFilterQuery = {
  search?: string;
  categoryId?: string;
  storeId?: string;
  brands?: string[];
  priceMinMinor?: number;
  priceMaxMinor?: number;
};

export class CatalogService {
  constructor(private readonly db: CommerceDatabase) {}

  async getSettings(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(catalogSettings)
      .where(eq(catalogSettings.tenantId, tenantId))
      .limit(1);
    if (!row) {
      const [created] = await this.db
        .insert(catalogSettings)
        .values({
          tenantId,
          retailMarkup: "2.0",
          brandAllowlist: [],
          storageConfig: {},
        })
        .returning();
      return created!;
    }
    return row;
  }

  async updateSettings(
    tenantId: string,
    input: { retailMarkup?: string; brandAllowlist?: string[] },
    actor: Actor,
  ) {
    const current = await this.getSettings(tenantId);
    const [updated] = await this.db
      .update(catalogSettings)
      .set({
        retailMarkup: input.retailMarkup ?? current.retailMarkup,
        brandAllowlist: input.brandAllowlist ?? current.brandAllowlist,
        updatedAt: new Date(),
        createdBy: actor,
      })
      .where(eq(catalogSettings.id, current.id))
      .returning();
    return updated!;
  }

  async listCategories(
    tenantId: string,
    storeId?: string,
    /** Storefront use only — hides categories with zero active products
     * (e.g. taxonomy seeded ahead of a vendor that doesn't carry that
     * product type yet) so customers never land on a dead-end "0 items"
     * filter. Staff/admin keeps seeing every category regardless, since
     * they need to manage ones that are empty today. */
    onlyWithProducts = false,
  ) {
    let rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.tenantId, tenantId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    if (storeId) {
      const allowedIds = await this.visibleCategoryIds(storeId);
      if (allowedIds !== null) {
        const allowed = new Set(allowedIds);
        rows = rows.filter((row) => allowed.has(row.id));
      }
    }

    if (onlyWithProducts) {
      const withProducts = await this.db
        .selectDistinct({ categoryId: ssProductCategories.categoryId })
        .from(ssProductCategories)
        .innerJoin(ssProducts, eq(ssProductCategories.productUuid, ssProducts.id))
        .where(
          and(
            eq(ssProductCategories.tenantId, tenantId),
            eq(ssProducts.active, true),
          ),
        );
      const nonEmpty = new Set(withProducts.map((row) => row.categoryId));
      rows = rows.filter((row) => nonEmpty.has(row.id));
    }

    return rows;
  }

  /** null = no restriction (store sees the full catalog); array = allow-list. */
  private async visibleCategoryIds(storeId: string): Promise<string[] | null> {
    const rows = await this.db
      .select({ categoryId: storeCategoryVisibility.categoryId })
      .from(storeCategoryVisibility)
      .where(eq(storeCategoryVisibility.storeId, storeId));
    if (rows.length === 0) return null;
    return rows.map((row) => row.categoryId);
  }

  async getCategoryVisibility(tenantId: string, storeId: string) {
    return this.visibleCategoryIds(storeId);
  }

  async setCategoryVisibility(
    tenantId: string,
    storeId: string,
    categoryIds: string[],
    actor: Actor,
  ) {
    await this.db
      .delete(storeCategoryVisibility)
      .where(eq(storeCategoryVisibility.storeId, storeId));
    for (const categoryId of categoryIds) {
      await this.db.insert(storeCategoryVisibility).values({
        tenantId,
        storeId,
        categoryId,
        createdBy: actor,
        source: { system: "commerce_api" },
      });
    }
    return this.visibleCategoryIds(storeId);
  }

  async createCategory(
    tenantId: string,
    input: {
      name: string;
      slug: string;
      parentId?: string | null;
      sortOrder?: number;
    },
    actor: Actor,
  ) {
    const [created] = await this.db
      .insert(categories)
      .values({
        tenantId,
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdBy: actor,
        source: { system: "commerce_api" },
      })
      .returning();
    return created!;
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: Partial<{
      name: string;
      slug: string;
      parentId: string | null;
      sortOrder: number;
    }>,
  ) {
    const [updated] = await this.db
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId)),
      )
      .returning();
    if (!updated) throw new ResourceNotFoundError("Category not found");
    return updated;
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    const [assigned] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ssProductCategories)
      .where(
        and(
          eq(ssProductCategories.tenantId, tenantId),
          eq(ssProductCategories.categoryId, categoryId),
        ),
      );
    if ((assigned?.count ?? 0) > 0) {
      throw new DataIntegrityError(
        "Reassign products before deleting this category",
      );
    }
    await this.db
      .delete(ssCategoryMap)
      .where(
        and(
          eq(ssCategoryMap.tenantId, tenantId),
          eq(ssCategoryMap.categoryId, categoryId),
        ),
      );
    await this.db
      .delete(categories)
      .where(
        and(eq(categories.tenantId, tenantId), eq(categories.id, categoryId)),
      );
  }

  async reorderCategories(
    tenantId: string,
    orderedIds: string[],
  ) {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await this.db
        .update(categories)
        .set({ sortOrder: (index + 1) * 10, updatedAt: new Date() })
        .where(
          and(
            eq(categories.tenantId, tenantId),
            eq(categories.id, orderedIds[index]!),
          ),
        );
    }
    return this.listCategories(tenantId);
  }

  async listMappings(tenantId: string) {
    return this.db
      .select()
      .from(ssCategoryMap)
      .where(eq(ssCategoryMap.tenantId, tenantId))
      .orderBy(asc(ssCategoryMap.ssCategoryKey));
  }

  async listUnmapped(tenantId: string) {
    return this.db
      .select()
      .from(ssUnmappedCategories)
      .where(eq(ssUnmappedCategories.tenantId, tenantId))
      .orderBy(desc(ssUnmappedCategories.styleCount));
  }

  async upsertMapping(
    tenantId: string,
    input: {
      ssCategoryKey: string;
      ssCategoryLabel?: string;
      categoryIds: string[];
    },
    actor: Actor,
  ) {
    await this.db
      .delete(ssCategoryMap)
      .where(
        and(
          eq(ssCategoryMap.tenantId, tenantId),
          eq(ssCategoryMap.ssCategoryKey, input.ssCategoryKey),
        ),
      );
    for (const categoryId of input.categoryIds) {
      await this.db.insert(ssCategoryMap).values({
        tenantId,
        ssCategoryKey: input.ssCategoryKey,
        ssCategoryLabel: input.ssCategoryLabel ?? input.ssCategoryKey,
        categoryId,
        createdBy: actor,
        source: { system: "commerce_api" },
      });
    }
    await this.db
      .delete(ssUnmappedCategories)
      .where(
        and(
          eq(ssUnmappedCategories.tenantId, tenantId),
          eq(ssUnmappedCategories.ssCategoryKey, input.ssCategoryKey),
        ),
      );
    await this.refileProductsForSsCategory(tenantId, input.ssCategoryKey);
    return this.listMappings(tenantId);
  }

  async setProductOverrides(
    tenantId: string,
    productUuid: string,
    categoryIds: string[],
    actor: Actor,
  ) {
    await this.db
      .delete(categoryOverrides)
      .where(
        and(
          eq(categoryOverrides.tenantId, tenantId),
          eq(categoryOverrides.productUuid, productUuid),
        ),
      );
    await this.db
      .delete(ssProductCategories)
      .where(
        and(
          eq(ssProductCategories.tenantId, tenantId),
          eq(ssProductCategories.productUuid, productUuid),
        ),
      );
    for (const categoryId of categoryIds) {
      await this.db.insert(categoryOverrides).values({
        tenantId,
        productUuid,
        categoryId,
        createdBy: actor,
        source: { system: "commerce_api" },
      });
      await this.db.insert(ssProductCategories).values({
        tenantId,
        productUuid,
        categoryId,
        assignmentSource: "override",
      });
    }
  }

  async updateProduct(
    tenantId: string,
    productUuid: string,
    input: Partial<{ active: boolean; isDark: boolean }>,
  ) {
    const [updated] = await this.db
      .update(ssProducts)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.id, productUuid),
        ),
      )
      .returning();
    if (!updated) throw new ResourceNotFoundError("Product not found");
    return updated;
  }

  /** Distinct brand names with at least one active product, for the
   * storefront brand filter — mirrors listCategories' onlyWithProducts
   * shape so a brand never appears as a dead-end filter option. */
  async listBrands(tenantId: string) {
    const rows = await this.db
      .selectDistinct({ brandName: ssStyles.brandName })
      .from(ssStyles)
      .innerJoin(ssProducts, eq(ssProducts.styleUuid, ssStyles.id))
      .where(and(eq(ssStyles.tenantId, tenantId), eq(ssProducts.active, true)))
      .orderBy(asc(ssStyles.brandName));
    return rows.map((row) => row.brandName);
  }

  /** Shared by listProducts/countProducts so the row count and the page of
   * rows are always computed against identical filters. */
  private async resolveProductFilters(
    tenantId: string,
    query?: ProductFilterQuery,
  ): Promise<{ whereClause: ReturnType<typeof and>; empty: boolean }> {
    let visibleProductIds: string[] | null = null;
    if (query?.storeId) {
      const allowedCategoryIds = await this.visibleCategoryIds(query.storeId);
      if (allowedCategoryIds !== null) {
        if (query.categoryId && !allowedCategoryIds.includes(query.categoryId)) {
          return { whereClause: undefined, empty: true };
        }
        if (!query.categoryId) {
          const rows = await this.db
            .selectDistinct({ productUuid: ssProductCategories.productUuid })
            .from(ssProductCategories)
            .where(
              and(
                eq(ssProductCategories.tenantId, tenantId),
                inArray(ssProductCategories.categoryId, allowedCategoryIds),
              ),
            );
          visibleProductIds = rows.map((row) => row.productUuid);
          if (visibleProductIds.length === 0) {
            return { whereClause: undefined, empty: true };
          }
        }
      }
    }

    let priceFilteredIds: string[] | null = null;
    if (query?.priceMinMinor != null || query?.priceMaxMinor != null) {
      const settings = await this.getSettings(tenantId);
      const markup = Number(settings.retailMarkup) || 2;
      const min = query.priceMinMinor ?? 0;
      const max = query.priceMaxMinor ?? Number.MAX_SAFE_INTEGER;
      // Filter on the same "from" price shown on the tile (cheapest
      // variant per product), not any variant — otherwise a product
      // displayed as "from $8" could appear under a $10-$15 filter just
      // because an unrelated size happens to fall in that range.
      const cheapestPerProduct = await this.db
        .selectDistinctOn([ssVariants.productUuid], {
          productUuid: ssVariants.productUuid,
          customerPriceMinor: ssVariants.customerPriceMinor,
          mapPriceMinor: ssVariants.mapPriceMinor,
        })
        .from(ssVariants)
        .innerJoin(ssProducts, eq(ssProducts.id, ssVariants.productUuid))
        .where(eq(ssProducts.tenantId, tenantId))
        .orderBy(asc(ssVariants.productUuid), asc(ssVariants.customerPriceMinor));
      priceFilteredIds = cheapestPerProduct
        .filter((v) => {
          const retail = retailFromCost(v.customerPriceMinor, v.mapPriceMinor, markup);
          return retail >= min && retail <= max;
        })
        .map((v) => v.productUuid);
      if (priceFilteredIds.length === 0) {
        return { whereClause: undefined, empty: true };
      }
    }

    const whereClause = and(
      eq(ssProducts.tenantId, tenantId),
      query?.search
        ? or(
            ilike(ssProducts.colorName, `%${query.search}%`),
            ilike(ssStyles.brandName, `%${query.search}%`),
            ilike(ssStyles.styleName, `%${query.search}%`),
            ilike(ssProducts.slug, `%${query.search}%`),
          )
        : undefined,
      visibleProductIds ? inArray(ssProducts.id, visibleProductIds) : undefined,
      query?.brands?.length ? inArray(ssStyles.brandName, query.brands) : undefined,
      priceFilteredIds ? inArray(ssProducts.id, priceFilteredIds) : undefined,
    );
    return { whereClause, empty: false };
  }

  async countProducts(
    tenantId: string,
    query?: ProductFilterQuery,
  ): Promise<number> {
    const { whereClause, empty } = await this.resolveProductFilters(tenantId, query);
    if (empty) return 0;

    const [row] = query?.categoryId
      ? await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .innerJoin(
            ssProductCategories,
            and(
              eq(ssProductCategories.productUuid, ssProducts.id),
              eq(ssProductCategories.categoryId, query.categoryId),
            ),
          )
          .where(whereClause)
      : await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .where(whereClause);
    return row?.count ?? 0;
  }

  async listProducts(
    tenantId: string,
    query?: ProductFilterQuery & { limit?: number; offset?: number },
  ) {
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    const settings = await this.getSettings(tenantId);
    const markup = Number(settings.retailMarkup) || 2;

    const { whereClause, empty } = await this.resolveProductFilters(tenantId, query);
    if (empty) return [];

    // Category filtering is done as a join in the same query (not a
    // per-row post-filter) so `limit` is honoured correctly and the
    // category check doesn't cost a round trip per row. A stable order
    // (brand, style, id) keeps pagination deterministic across pages.
    const rows = query?.categoryId
      ? await this.db
          .select({ product: ssProducts, style: ssStyles })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .innerJoin(
            ssProductCategories,
            and(
              eq(ssProductCategories.productUuid, ssProducts.id),
              eq(ssProductCategories.categoryId, query.categoryId),
            ),
          )
          .where(whereClause)
          .orderBy(asc(ssStyles.brandName), asc(ssStyles.styleName), asc(ssProducts.id))
          .limit(limit)
          .offset(offset)
      : await this.db
          .select({ product: ssProducts, style: ssStyles })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .where(whereClause)
          .orderBy(asc(ssStyles.brandName), asc(ssStyles.styleName), asc(ssProducts.id))
          .limit(limit)
          .offset(offset);

    if (rows.length === 0) return [];

    // Cheapest variant per product in a single batched query instead of
    // one round trip per product (was the dominant cost of this endpoint).
    const productIds = rows.map((row) => row.product.id);
    const cheapestVariants = await this.db
      .selectDistinctOn([ssVariants.productUuid], {
        productUuid: ssVariants.productUuid,
        customerPriceMinor: ssVariants.customerPriceMinor,
        mapPriceMinor: ssVariants.mapPriceMinor,
      })
      .from(ssVariants)
      .where(inArray(ssVariants.productUuid, productIds))
      .orderBy(asc(ssVariants.productUuid), asc(ssVariants.customerPriceMinor));
    const variantByProduct = new Map(
      cheapestVariants.map((v) => [v.productUuid, v]),
    );

    return rows.map((row) => {
      const variant = variantByProduct.get(row.product.id);
      const cost = variant?.customerPriceMinor ?? 0;
      const map = variant?.mapPriceMinor ?? null;
      return {
        ...row.product,
        brandName: row.style.brandName,
        styleName: row.style.styleName,
        title: row.style.title,
        // Falls back to the style's generic photo when this colorway has
        // no photo of its own — without it, ~5% of active products (no
        // per-color photo from the vendor feed) rendered as a blank grey
        // card with no image at all, even though a usable photo existed.
        styleImageUrl: row.style.styleImageUrl,
        costMinor: cost,
        retailMinor: retailFromCost(cost, map, markup),
        mapPriceMinor: map,
        available: (row.product.qty ?? 0) > 0 && row.product.active,
      };
    });
  }

  async getProductDetail(tenantId: string, productUuid: string) {
    const [row] = await this.db
      .select({
        product: ssProducts,
        style: ssStyles,
      })
      .from(ssProducts)
      .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.id, productUuid),
        ),
      )
      .limit(1);
    if (!row) throw new ResourceNotFoundError("Product not found");
    const variants = await this.db
      .select()
      .from(ssVariants)
      .where(eq(ssVariants.productUuid, productUuid))
      .orderBy(asc(ssVariants.sizeOrder));
    const cats = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        source: ssProductCategories.assignmentSource,
      })
      .from(ssProductCategories)
      .innerJoin(categories, eq(ssProductCategories.categoryId, categories.id))
      .where(eq(ssProductCategories.productUuid, productUuid));
    const settings = await this.getSettings(tenantId);
    const markup = Number(settings.retailMarkup) || 2;

    // Other colorways of the same style, so the PDP can offer a real
    // colour switcher instead of showing one fixed photo with no way to
    // see what else the garment comes in.
    const colorways = await this.db
      .select({
        id: ssProducts.id,
        slug: ssProducts.slug,
        colorName: ssProducts.colorName,
        swatchImageUrl: ssProducts.colorSwatchImageUrl,
        frontImageUrl: ssProducts.colorFrontImageUrl,
        active: ssProducts.active,
      })
      .from(ssProducts)
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.styleUuid, row.product.styleUuid),
          eq(ssProducts.active, true),
        ),
      )
      .orderBy(asc(ssProducts.colorName));

    return {
      product: row.product,
      style: row.style,
      variants: variants.map((variant) => ({
        ...variant,
        retailMinor: retailFromCost(
          variant.customerPriceMinor,
          variant.mapPriceMinor,
          markup,
        ),
      })),
      categories: cats,
      colorways,
      retailMarkup: markup,
    };
  }

  async listSyncRuns(tenantId: string) {
    return this.db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.tenantId, tenantId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(20);
  }

  async dashboard(tenantId: string) {
    const [productCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ssProducts)
      .where(eq(ssProducts.tenantId, tenantId));
    const [unmappedCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ssUnmappedCategories)
      .where(eq(ssUnmappedCategories.tenantId, tenantId));
    const [lastSync] = await this.db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.tenantId, tenantId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);
    return {
      productCount: productCount?.count ?? 0,
      unmappedCount: unmappedCount?.count ?? 0,
      lastSync: lastSync ?? null,
    };
  }

  private async refileProductsForSsCategory(
    tenantId: string,
    ssCategoryKey: string,
  ) {
    const products = await this.db
      .select()
      .from(ssProducts)
      .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
      .where(eq(ssProducts.tenantId, tenantId));

    const maps = await this.db
      .select()
      .from(ssCategoryMap)
      .where(
        and(
          eq(ssCategoryMap.tenantId, tenantId),
          eq(ssCategoryMap.ssCategoryKey, ssCategoryKey),
        ),
      );
    if (maps.length === 0) return;

    for (const row of products) {
      const styleCats = row.ss_styles.ssCategories ?? [];
      if (
        !styleCats.includes(ssCategoryKey) &&
        row.ss_styles.baseCategory !== ssCategoryKey
      ) {
        continue;
      }
      const overrides = await this.db
        .select()
        .from(categoryOverrides)
        .where(eq(categoryOverrides.productUuid, row.ss_products.id));
      if (overrides.length > 0) continue;

      for (const map of maps) {
        await this.db
          .insert(ssProductCategories)
          .values({
            tenantId,
            productUuid: row.ss_products.id,
            categoryId: map.categoryId,
            assignmentSource: "map",
            source: { system: "commerce_api" },
          })
          .onConflictDoNothing();
      }
    }
  }
}
