import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
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
  syncRuns,
} from "../db/schema.js";
import { retailFromCost } from "../adapters/ss-activewear/client.js";
import {
  DataIntegrityError,
  ResourceNotFoundError,
} from "./job-request-service.js";

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

  async listCategories(tenantId: string) {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.tenantId, tenantId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
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

  async listProducts(
    tenantId: string,
    query?: { search?: string; categoryId?: string; limit?: number },
  ) {
    const limit = query?.limit ?? 50;
    const settings = await this.getSettings(tenantId);
    const markup = Number(settings.retailMarkup) || 2;

    const rows = await this.db
      .select({
        product: ssProducts,
        style: ssStyles,
      })
      .from(ssProducts)
      .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          query?.search
            ? or(
                ilike(ssProducts.colorName, `%${query.search}%`),
                ilike(ssStyles.brandName, `%${query.search}%`),
                ilike(ssStyles.styleName, `%${query.search}%`),
                ilike(ssProducts.slug, `%${query.search}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(ssStyles.brandName), asc(ssStyles.styleName))
      .limit(limit);

    const result = [];
    for (const row of rows) {
      if (query?.categoryId) {
        const [link] = await this.db
          .select()
          .from(ssProductCategories)
          .where(
            and(
              eq(ssProductCategories.productUuid, row.product.id),
              eq(ssProductCategories.categoryId, query.categoryId),
            ),
          )
          .limit(1);
        if (!link) continue;
      }
      const [variant] = await this.db
        .select()
        .from(ssVariants)
        .where(eq(ssVariants.productUuid, row.product.id))
        .orderBy(asc(ssVariants.customerPriceMinor))
        .limit(1);
      const cost = variant?.customerPriceMinor ?? 0;
      const map = variant?.mapPriceMinor ?? null;
      result.push({
        ...row.product,
        brandName: row.style.brandName,
        styleName: row.style.styleName,
        title: row.style.title,
        costMinor: cost,
        retailMinor: retailFromCost(cost, map, markup),
        mapPriceMinor: map,
        available: (row.product.qty ?? 0) > 0 && row.product.active,
      });
    }
    return result;
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
