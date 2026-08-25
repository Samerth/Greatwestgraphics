import { and, asc, desc, eq, exists, gt, ilike, inArray, lte, not, or, sql } from "drizzle-orm";
import type { Actor, PricingConfigV2 } from "@gwg/contracts";
import { PricingConfigV2Schema } from "@gwg/contracts";
import {
  garmentPriceCurve,
  PRICING_MASTER_V2,
  priceShopperItem,
  type GarmentPriceCurve,
} from "@gwg/pricing";
import type { CommerceDatabase } from "../db/client.js";
import {
  catalogSettings,
  categories,
  categoryOverrides,
  pricingConfigs,
  ssCategoryMap,
  ssProductCategories,
  ssProducts,
  ssStyleColumnsWithoutSizeSpecs,
  ssStyles,
  ssUnmappedCategories,
  ssVariants,
  storeCategoryVisibility,
  syncRuns,
} from "../db/schema.js";
import { isMissingColumn } from "../db/postgres-error.js";
import {
  DataIntegrityError,
  ResourceNotFoundError,
} from "./job-request-service.js";
import { mapSizeSpecsToChart, parseSizeSpecRows } from "./size-specs.js";
import { pickRepresentativeByStyle } from "./style-grouping.js";

/** S&S sells its own printed catalogue through the same styles feed.
 * These are not garment brands and are hidden from shopper-facing lists. */
const NON_GARMENT_BRANDS = ["Catalogs"];

type ProductFilterQuery = {
  search?: string;
  categoryId?: string;
  storeId?: string;
  brands?: string[];
  priceMinMinor?: number;
  priceMaxMinor?: number;
  vendor?: string;
  /** Staff soft-hide filter. Storefront callers should use storefrontOnly. */
  visibility?: "visible" | "hidden" | "all";
  stock?: "in" | "oos" | "any";
  sort?: "brand" | "style" | "stock" | "updated";
  /**
   * When true, omit soft-hidden colorways entirely (PLP / brands / sitemap /
   * design picker). Admin list sets this false and uses `visibility` instead.
   */
  storefrontOnly?: boolean;
  /**
   * Storefront PLP: one row per `ss_styles` garment, not one per colourway.
   * Admin lists leave this unset so staff can hide individual colours.
   */
  groupByStyle?: boolean;
};

export class CatalogService {
  constructor(private readonly db: CommerceDatabase) {}

  /**
   * Advertised catalog prices use the published v2 config (or the bundled
   * workbook defaults). The same helper prices tiles, the PDP, and admin
   * preview, so a shopper never sees a different number than staff just set.
   */
  private async garmentPricer(tenantId: string): Promise<{
    /** Price shown on a tile: the advertised catalog quantity. */
    price: (
      costMinor: number,
      mapPriceMinor: number | null,
      context?: { colourName?: string; isDark?: boolean },
    ) => number;
    /** Quantity the tile price advertises. */
    displayQty: number;
    /**
     * The garment's markup row, so a page with its own quantity picker can
     * re-price without another round trip. Null on the flat fallback.
     */
    curveFor: (costMinor: number) => GarmentPriceCurve | null;
    pricingConfig: PricingConfigV2;
  }> {
    const [row] = await this.db
      .select()
      .from(pricingConfigs)
      .where(
        and(
          eq(pricingConfigs.tenantId, tenantId),
          eq(pricingConfigs.status, "published"),
          eq(pricingConfigs.schemaVersion, 2),
        ),
      )
      .limit(1);

    const parsed = row
      ? PricingConfigV2Schema.safeParse(row.config)
      : undefined;
    const config = parsed?.success
      ? parsed.data
      : PricingConfigV2Schema.parse(PRICING_MASTER_V2);
    const displayQty = config.garment.catalogDisplayQty;
    return {
      displayQty,
      pricingConfig: config,
      price: (costMinor, mapPriceMinor, context) =>
        priceShopperItem(config, {
          unitCostMinor: costMinor,
          quantity: displayQty,
          mapPriceMinor,
          colourName: context?.colourName,
          isDark: context?.isDark,
        }).summary.unitMinor,
      curveFor: (costMinor) => {
        try {
          return garmentPriceCurve(config, costMinor);
        } catch {
          return null;
        }
      },
    };
  }

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
            eq(ssProducts.storefrontVisible, true),
          ),
        );
      const directlyNonEmpty = new Set(withProducts.map((row) => row.categoryId));

      // Bubble non-empty state through every ancestor. The published taxonomy
      // is deeper than two levels, so checking only direct parents hides a
      // department whose products are assigned to grandchildren.
      const nonEmpty = new Set(directlyNonEmpty);
      const parentById = new Map(rows.map((row) => [row.id, row.parentId]));
      for (const categoryId of directlyNonEmpty) {
        let parentId = parentById.get(categoryId) ?? null;
        while (parentId) {
          if (nonEmpty.has(parentId)) break;
          nonEmpty.add(parentId);
          parentId = parentById.get(parentId) ?? null;
        }
      }

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
    input: Partial<{
      active: boolean;
      isDark: boolean;
      storefrontVisible: boolean;
    }>,
    actor?: Actor,
  ) {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.active !== undefined) patch.active = input.active;
    if (input.isDark !== undefined) patch.isDark = input.isDark;
    if (input.storefrontVisible !== undefined) {
      patch.storefrontVisible = input.storefrontVisible;
      if (input.storefrontVisible) {
        patch.hiddenAt = null;
        patch.hiddenBy = null;
      } else {
        patch.hiddenAt = new Date();
        patch.hiddenBy = actor ?? null;
      }
    }
    const [updated] = await this.db
      .update(ssProducts)
      .set(patch)
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

  async bulkSetStorefrontVisible(
    tenantId: string,
    productIds: string[],
    storefrontVisible: boolean,
    actor: Actor,
  ) {
    if (productIds.length === 0) {
      return { updated: 0 };
    }
    const patch = storefrontVisible
      ? {
          storefrontVisible: true,
          hiddenAt: null as Date | null,
          hiddenBy: null as Actor | null,
          updatedAt: new Date(),
        }
      : {
          storefrontVisible: false,
          hiddenAt: new Date(),
          hiddenBy: actor,
          updatedAt: new Date(),
        };
    const updated = await this.db
      .update(ssProducts)
      .set(patch)
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          inArray(ssProducts.id, productIds),
        ),
      )
      .returning({ id: ssProducts.id });
    return { updated: updated.length };
  }

  /** Distinct brand names with at least one storefront-visible product, for the
   * storefront brand filter — mirrors listCategories' onlyWithProducts
   * shape so a brand never appears as a dead-end filter option. */
  async listBrands(tenantId: string) {
    const rows = await this.db
      .selectDistinct({ brandName: ssStyles.brandName })
      .from(ssStyles)
      .innerJoin(ssProducts, eq(ssProducts.styleUuid, ssStyles.id))
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssProducts.active, true),
          eq(ssProducts.storefrontVisible, true),
          // S&S lists its own printed paper catalogue under a "Catalogs"
          // brand. It isn't a garment manufacturer, so showing it beside
          // Adidas and Champion in the shopper-facing brand filter is
          // just confusing.
          not(inArray(ssStyles.brandName, NON_GARMENT_BRANDS)),
        ),
      )
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
      const { price: priceGarment } = await this.garmentPricer(tenantId);
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
          const retail = priceGarment(v.customerPriceMinor, v.mapPriceMinor);
          return retail >= min && retail <= max;
        })
        .map((v) => v.productUuid);
      if (priceFilteredIds.length === 0) {
        return { whereClause: undefined, empty: true };
      }
    }

    // Every whitespace-separated word must match somewhere, but not
    // necessarily in the same column — "navy hoodie" is colour on the
    // product and garment type in the style title, so matching the raw
    // phrase against any single column would return nothing.
    const searchTerms = (query?.search ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const searchClauses = searchTerms.map((term) =>
      or(
        ilike(ssProducts.colorName, `%${term}%`),
        ilike(ssStyles.brandName, `%${term}%`),
        ilike(ssStyles.styleName, `%${term}%`),
        ilike(ssStyles.title, `%${term}%`),
        ilike(ssStyles.baseCategory, `%${term}%`),
        ilike(ssProducts.slug, `%${term}%`),
        ilike(ssStyles.externalKey, `%${term}%`),
        ilike(ssStyles.partNumber, `%${term}%`),
        exists(
          this.db
            .select({ id: ssVariants.id })
            .from(ssVariants)
            .where(
              and(
                eq(ssVariants.productUuid, ssProducts.id),
                or(
                  ilike(ssVariants.sku, `%${term}%`),
                  ilike(ssVariants.externalKey, `%${term}%`),
                ),
              ),
            ),
        ),
      ),
    );

    const storefrontOnly = query?.storefrontOnly === true;
    const visibility = storefrontOnly
      ? "visible"
      : (query?.visibility ?? "all");
    const visibilityClause =
      visibility === "visible"
        ? eq(ssProducts.storefrontVisible, true)
        : visibility === "hidden"
          ? eq(ssProducts.storefrontVisible, false)
          : undefined;

    const stock = query?.stock ?? "any";
    const stockClause =
      stock === "in"
        ? gt(ssProducts.qty, 0)
        : stock === "oos"
          ? lte(ssProducts.qty, 0)
          : undefined;

    const whereClause = and(
      eq(ssProducts.tenantId, tenantId),
      ...searchClauses,
      visibleProductIds ? inArray(ssProducts.id, visibleProductIds) : undefined,
      query?.brands?.length ? inArray(ssStyles.brandName, query.brands) : undefined,
      priceFilteredIds ? inArray(ssProducts.id, priceFilteredIds) : undefined,
      query?.vendor ? eq(ssProducts.vendor, query.vendor) : undefined,
      visibilityClause,
      stockClause,
    );
    return { whereClause, empty: false };
  }

  private productOrderBy(sort?: ProductFilterQuery["sort"]) {
    switch (sort) {
      case "style":
        return [asc(ssStyles.styleName), asc(ssProducts.colorName), asc(ssProducts.id)];
      case "stock":
        return [desc(ssProducts.qty), asc(ssStyles.brandName), asc(ssProducts.id)];
      case "updated":
        return [desc(ssProducts.updatedAt), asc(ssProducts.id)];
      case "brand":
      default:
        return [asc(ssStyles.brandName), asc(ssStyles.styleName), asc(ssProducts.id)];
    }
  }

    /** A category filter matches products tagged anywhere below it (any depth). */
  private async expandCategoryIds(
    tenantId: string,
    categoryId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.tenantId, tenantId));
    const childrenByParent = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.parentId) continue;
      childrenByParent.set(row.parentId, [
        ...(childrenByParent.get(row.parentId) ?? []),
        row.id,
      ]);
    }
    const expanded: string[] = [];
    const pending = [categoryId];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      expanded.push(current);
      pending.push(...(childrenByParent.get(current) ?? []));
    }
    return expanded;
  }

  async countProducts(
    tenantId: string,
    query?: ProductFilterQuery,
  ): Promise<number> {
    const { whereClause, empty } = await this.resolveProductFilters(tenantId, query);
    if (empty) return 0;

    const categoryIds = query?.categoryId
      ? await this.expandCategoryIds(tenantId, query.categoryId)
      : null;

    const countExpr = query?.groupByStyle
      ? sql<number>`count(distinct ${ssProducts.styleUuid})::int`
      : sql<number>`count(*)::int`;

    const [row] = categoryIds
      ? await this.db
          .select({ count: countExpr })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .innerJoin(
            ssProductCategories,
            and(
              eq(ssProductCategories.productUuid, ssProducts.id),
              inArray(ssProductCategories.categoryId, categoryIds),
            ),
          )
          .where(whereClause)
      : await this.db
          .select({ count: countExpr })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .where(whereClause);
    return row?.count ?? 0;
  }

  /** Paginated style ids for storefront tiles — one garment, not N colours. */
  private async listGroupedStyleIds(
    tenantId: string,
    query: ProductFilterQuery & { limit?: number; offset?: number },
    whereClause: ReturnType<typeof and>,
  ): Promise<string[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const categoryIds = query.categoryId
      ? await this.expandCategoryIds(tenantId, query.categoryId)
      : null;

    const orderBy = (() => {
      switch (query.sort) {
        case "style":
          return [
            asc(ssStyles.styleName),
            asc(ssStyles.brandName),
            asc(ssProducts.styleUuid),
          ];
        case "stock":
          return [
            desc(sql`max(${ssProducts.qty})`),
            asc(ssStyles.brandName),
            asc(ssProducts.styleUuid),
          ];
        case "updated":
          return [desc(sql`max(${ssProducts.updatedAt})`), asc(ssProducts.styleUuid)];
        case "brand":
        default:
          return [
            asc(ssStyles.brandName),
            asc(ssStyles.styleName),
            asc(ssProducts.styleUuid),
          ];
      }
    })();

    const rows = categoryIds
      ? await this.db
          .select({ styleUuid: ssProducts.styleUuid })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .innerJoin(
            ssProductCategories,
            and(
              eq(ssProductCategories.productUuid, ssProducts.id),
              inArray(ssProductCategories.categoryId, categoryIds),
            ),
          )
          .where(whereClause)
          .groupBy(ssProducts.styleUuid, ssStyles.brandName, ssStyles.styleName)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset)
      : await this.db
          .select({ styleUuid: ssProducts.styleUuid })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .where(whereClause)
          .groupBy(ssProducts.styleUuid, ssStyles.brandName, ssStyles.styleName)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset);

    return rows.map((row) => row.styleUuid);
  }

  async listProducts(
    tenantId: string,
    query?: ProductFilterQuery & { limit?: number; offset?: number },
  ) {
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    const { price: priceGarment } = await this.garmentPricer(tenantId);

    const { whereClause, empty } = await this.resolveProductFilters(tenantId, query);
    if (empty) return [];

    const styleColumns = ssStyleColumnsWithoutSizeSpecs();
    const grouped =
      query?.groupByStyle === true
        ? await this.listGroupedColorways(tenantId, query, whereClause)
        : null;

    // Category filtering is done as a join in the same query (not a
    // per-row post-filter) so `limit` is honoured correctly and the
    // category check doesn't cost a round trip per row. A stable order
    // (brand, style, id) keeps pagination deterministic across pages.
    const categoryIds = grouped
      ? null
      : query?.categoryId
        ? await this.expandCategoryIds(tenantId, query.categoryId)
        : null;
    const orderBy = this.productOrderBy(query?.sort);
    const rows = grouped
      ? grouped.rows
      : categoryIds
        ? await this.db
            .select({ product: ssProducts, style: styleColumns })
            .from(ssProducts)
            .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
            .innerJoin(
              ssProductCategories,
              and(
                eq(ssProductCategories.productUuid, ssProducts.id),
                inArray(ssProductCategories.categoryId, categoryIds),
              ),
            )
            .where(whereClause)
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset)
        : await this.db
            .select({ product: ssProducts, style: styleColumns })
            .from(ssProducts)
            .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
            .where(whereClause)
            .orderBy(...orderBy)
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
        externalKey: row.style.externalKey,
        partNumber: row.style.partNumber,
        // Falls back to the style's generic photo when this colorway has
        // no photo of its own — without it, ~5% of active products (no
        // per-color photo from the vendor feed) rendered as a blank grey
        // card with no image at all, even though a usable photo existed.
        styleImageUrl: row.style.styleImageUrl,
        costMinor: cost,
        retailMinor: priceGarment(cost, map, {
          colourName: row.product.colorName,
          isDark: row.product.isDark,
        }),
        mapPriceMinor: map,
        available:
          (row.product.qty ?? 0) > 0 &&
          row.product.active &&
          row.product.storefrontVisible,
        colorwayCount: grouped?.countByStyle.get(row.product.styleUuid) ?? 1,
      };
    });
  }

  private async listGroupedColorways(
    tenantId: string,
    query: ProductFilterQuery & { limit?: number; offset?: number },
    whereClause: ReturnType<typeof and>,
  ) {
    const styleUuids = await this.listGroupedStyleIds(tenantId, query, whereClause);
    if (styleUuids.length === 0) {
      return { rows: [], countByStyle: new Map<string, number>() };
    }

    const styleColumns = ssStyleColumnsWithoutSizeSpecs();
    const categoryIds = query.categoryId
      ? await this.expandCategoryIds(tenantId, query.categoryId)
      : null;
    const siblingsRaw = categoryIds
      ? await this.db
          .select({ product: ssProducts, style: styleColumns })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .innerJoin(
            ssProductCategories,
            and(
              eq(ssProductCategories.productUuid, ssProducts.id),
              inArray(ssProductCategories.categoryId, categoryIds),
            ),
          )
          .where(and(whereClause, inArray(ssProducts.styleUuid, styleUuids)))
      : await this.db
          .select({ product: ssProducts, style: styleColumns })
          .from(ssProducts)
          .innerJoin(ssStyles, eq(ssProducts.styleUuid, ssStyles.id))
          .where(and(whereClause, inArray(ssProducts.styleUuid, styleUuids)));
    const siblings = [
      ...new Map(siblingsRaw.map((row) => [row.product.id, row])).values(),
    ];

    const picked = pickRepresentativeByStyle(
      siblings,
      (row) => ({
        id: row.product.id,
        styleUuid: row.product.styleUuid,
        colorName: row.product.colorName,
        slug: row.product.slug,
        qty: row.product.qty,
        active: row.product.active,
        colorFrontImageUrl: row.product.colorFrontImageUrl,
      }),
      { search: query.search },
    );
    const byStyle = new Map(
      picked.map((entry) => [entry.representative.product.styleUuid, entry]),
    );
    const rows = styleUuids
      .map((styleUuid) => byStyle.get(styleUuid)?.representative)
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const countByStyle = new Map(
      picked.map((entry) => [
        entry.representative.product.styleUuid,
        entry.colorwayCount,
      ]),
    );
    return { rows, countByStyle };
  }

  async getProductDetail(
    tenantId: string,
    productUuid: string,
    options?: { includeHiddenColorways?: boolean; storeId?: string },
  ) {
    const styleColumns = ssStyleColumnsWithoutSizeSpecs();
    const [row] = await this.db
      .select({
        product: ssProducts,
        style: styleColumns,
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
    const sizeSpecRows = await this.loadStyleSizeSpecs(row.style.id);
    const sizeSpecs = mapSizeSpecsToChart(sizeSpecRows);
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

    // Mirrors the same allow-list `listCategories` applies to browsing: a
    // store curated down to specific categories must not be reachable by a
    // direct link either. Without this, "curate which categories a store
    // can see" only hid a product from the nav — anyone with the URL, or
    // who guessed it, could still view and order it in full.
    if (options?.storeId) {
      const allowedIds = await this.visibleCategoryIds(options.storeId);
      if (allowedIds !== null) {
        const allowed = new Set(allowedIds);
        const visible = cats.some((cat) => allowed.has(cat.id));
        if (!visible) {
          throw new ResourceNotFoundError("Product not found");
        }
      }
    }

    const settings = await this.getSettings(tenantId);
    const markup = Number(settings.retailMarkup) || 2;
    const garmentPricing = await this.garmentPricer(tenantId);

    // Other colorways of the same style, so the PDP can offer a real
    // colour switcher instead of showing one fixed photo with no way to
    // see what else the garment comes in. Storefront omits soft-hidden
    // colorways; admin includes them with a visibility chip.
    const colorways = await this.db
      .select({
        id: ssProducts.id,
        slug: ssProducts.slug,
        colorName: ssProducts.colorName,
        colorHex: ssProducts.color1,
        swatchImageUrl: ssProducts.colorSwatchImageUrl,
        frontImageUrl: ssProducts.colorFrontImageUrl,
        sideImageUrl: ssProducts.colorSideImageUrl,
        backImageUrl: ssProducts.colorBackImageUrl,
        isDark: ssProducts.isDark,
        active: ssProducts.active,
        storefrontVisible: ssProducts.storefrontVisible,
        qty: ssProducts.qty,
      })
      .from(ssProducts)
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.styleUuid, row.product.styleUuid),
          eq(ssProducts.active, true),
          options?.includeHiddenColorways
            ? undefined
            : eq(ssProducts.storefrontVisible, true),
        ),
      )
      .orderBy(asc(ssProducts.colorName));

    return {
      product: row.product,
      style: { ...row.style, sizeSpecs: sizeSpecRows },
      sizeSpecs,
      variants: variants.map((variant) => ({
        ...variant,
        retailMinor: garmentPricing.price(
          variant.customerPriceMinor,
          variant.mapPriceMinor,
          {
            colourName: row.product.colorName,
            isDark: row.product.isDark,
          },
        ),
        priceCurve: garmentPricing.curveFor(variant.customerPriceMinor),
      })),
      categories: cats,
      colorways,
      retailMarkup: markup,
      /** Quantity the `retailMinor` prices above are quoted at. */
      priceDisplayQty: garmentPricing.displayQty,
      pricingConfig: garmentPricing.pricingConfig,
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

  /**
   * Isolated so a staging DB that has not applied 0022 still serves PDPs.
   * Missing `size_specs` is treated as "vendor sent nothing".
   */
  private async loadStyleSizeSpecs(styleUuid: string) {
    try {
      const [row] = await this.db
        .select({ sizeSpecs: ssStyles.sizeSpecs })
        .from(ssStyles)
        .where(eq(ssStyles.id, styleUuid))
        .limit(1);
      return parseSizeSpecRows(row?.sizeSpecs);
    } catch (error) {
      if (isMissingColumn(error, "size_specs")) return [];
      throw error;
    }
  }

  private async refileProductsForSsCategory(
    tenantId: string,
    ssCategoryKey: string,
  ) {
    const products = await this.db
      .select({
        productId: ssProducts.id,
        ssCategories: ssStyles.ssCategories,
        baseCategory: ssStyles.baseCategory,
      })
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
      const styleCats = row.ssCategories ?? [];
      if (
        !styleCats.includes(ssCategoryKey) &&
        row.baseCategory !== ssCategoryKey
      ) {
        continue;
      }
      const overrides = await this.db
        .select()
        .from(categoryOverrides)
        .where(eq(categoryOverrides.productUuid, row.productId));
      if (overrides.length > 0) continue;

      for (const map of maps) {
        await this.db
          .insert(ssProductCategories)
          .values({
            tenantId,
            productUuid: row.productId,
            categoryId: map.categoryId,
            assignmentSource: "map",
            source: { system: "commerce_api" },
          })
          .onConflictDoNothing();
      }
    }
  }
}
