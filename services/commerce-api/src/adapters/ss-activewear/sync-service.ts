import { and, eq, inArray, sql } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../../db/client.js";
import {
  catalogSettings,
  categoryOverrides,
  ssCategoryMap,
  ssProductCategories,
  ssProducts,
  ssStyles,
  ssUnmappedCategories,
  ssVariants,
  syncRuns,
  vendorMappings,
} from "../../db/schema.js";
import {
  SsActivewearClient,
  SsAuthError,
  SsNotFoundError,
  dollarsToMinor,
  groupSpecsByStyleId,
  isDarkHex,
  parseSizeOrder,
  slugify,
  type SsProductSku,
  type SsSizeSpecRow,
  type SsStyle,
} from "./client.js";
import { fallbackCategorySlugs } from "../catalog/writer.js";
import { isMissingColumn } from "../../db/postgres-error.js";
import { LocalSsImageStore } from "./image-store.js";

type SpecsIndex = {
  loaded: boolean;
  byStyle: Map<number, SsSizeSpecRow[]>;
};

const VENDOR = "ss_activewear";

function normalizeCategories(
  value: SsStyle["categories"] | string | undefined,
  baseCategory?: string,
): string[] {
  const keys = new Set<string>();
  if (baseCategory) keys.add(baseCategory.trim());
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item?.trim()) keys.add(item.trim());
    }
  } else if (typeof value === "string" && value.trim()) {
    for (const part of value.split(/[,|;]/)) {
      if (part.trim()) keys.add(part.trim());
    }
  }
  return [...keys];
}

function groupSkusByColor(skus: SsProductSku[]): Map<string, SsProductSku[]> {
  const map = new Map<string, SsProductSku[]>();
  for (const sku of skus) {
    const key = sku.colorName?.trim() || "Unknown";
    const list = map.get(key) ?? [];
    list.push(sku);
    map.set(key, list);
  }
  return map;
}

export class SsSyncService {
  constructor(
    private readonly db: CommerceDatabase,
    private readonly client: SsActivewearClient,
    private readonly images = new LocalSsImageStore(),
  ) {}

  async runFullSync(tenantId: string, actor: Actor) {
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        vendor: VENDOR,
        type: "full",
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api" },
      })
      .returning();
    if (!run) throw new Error("Failed to create sync run");

    let stylesProcessed = 0;
    let skusUpserted = 0;
    let imagesDownloaded = 0;
    const errors: string[] = [];

    try {
      const styles = await this.client.listStyles();
      const settings = await this.getSettings(tenantId);
      const allowlist = new Set(
        (settings?.brandAllowlist ?? []).map((brand) => brand.toLowerCase()),
      );
      const allowedStyles = styles.filter(
        (style) =>
          allowlist.size === 0 ||
          allowlist.has((style.brandName ?? "").toLowerCase()),
      );
      const specsIndex = await this.loadSpecsIndex(
        allowedStyles.map((style) => style.styleID),
      );

      for (const style of allowedStyles) {
        try {
          const result = await this.upsertStyleTree(
            tenantId,
            style,
            actor,
            specsIndex,
          );
          stylesProcessed += 1;
          skusUpserted += result.skusUpserted;
          imagesDownloaded += result.imagesDownloaded;
        } catch (error) {
          if (error instanceof SsNotFoundError) {
            await this.markStyleInactive(tenantId, style.styleID);
            continue;
          }
          errors.push(
            `style ${style.styleID}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      await this.refreshUnmapped(tenantId);

      await this.db
        .update(syncRuns)
        .set({
          status: errors.length ? "completed_with_errors" : "completed",
          stylesProcessed,
          skusUpserted,
          imagesDownloaded,
          rateLimitRemaining: this.client.rateLimitRemaining,
          errorSummary: errors.slice(0, 20).join("\n") || null,
          details: { errorCount: errors.length },
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));

      return {
        id: run.id,
        stylesProcessed,
        skusUpserted,
        imagesDownloaded,
        errors,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
    } catch (error) {
      await this.db
        .update(syncRuns)
        .set({
          status: "failed",
          stylesProcessed,
          skusUpserted,
          imagesDownloaded,
          rateLimitRemaining: this.client.rateLimitRemaining,
          errorSummary:
            error instanceof SsAuthError
              ? error.message
              : error instanceof Error
                ? error.message
                : String(error),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));
      throw error;
    }
  }

  /**
   * Refresh one style from S&S (style metadata + colorways/SKUs).
   * Does not overwrite storefront_visible on existing colorways.
   */
  async refreshStyle(tenantId: string, styleKey: string, actor: Actor) {
    const styleId = Number.parseInt(styleKey, 10);
    if (!Number.isFinite(styleId)) {
      throw new Error(`Invalid S&S style id: ${styleKey}`);
    }
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        vendor: VENDOR,
        type: "full",
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api" },
      })
      .returning();
    if (!run) throw new Error("Failed to create sync run");

    try {
      const style = await this.client.getStyle(styleId);
      const specsIndex = await this.loadSpecsIndex([styleId]);
      const result = await this.upsertStyleTree(
        tenantId,
        style,
        actor,
        specsIndex,
      );
      await this.db
        .update(syncRuns)
        .set({
          status: "completed",
          stylesProcessed: 1,
          skusUpserted: result.skusUpserted,
          imagesDownloaded: result.imagesDownloaded,
          rateLimitRemaining: this.client.rateLimitRemaining,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));
      return {
        id: run.id,
        stylesProcessed: 1,
        skusUpserted: result.skusUpserted,
        imagesDownloaded: result.imagesDownloaded,
        errors: [] as string[],
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
    } catch (error) {
      await this.db
        .update(syncRuns)
        .set({
          status: "failed",
          errorSummary:
            error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));
      throw error;
    }
  }

  async runInventorySync(tenantId: string, actor: Actor) {
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        vendor: VENDOR,
        type: "inventory",
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api" },
      })
      .returning();
    if (!run) throw new Error("Failed to create inventory sync run");

    try {
      // Products includes customerPrice; Inventory is qty-only (and nests qty
      // under warehouses). Prefer Products for "Update stock & price".
      let updated = 0;
      let source: "products" | "inventory" = "products";
      let warning: string | null = null;

      try {
        const rows = await this.client.listStockAndPrice();
        for (const row of rows) {
          updated += await this.applyVariantStockPrice(tenantId, {
            skuId: row.skuID_Master,
            sku: row.sku,
            qty: row.qty ?? 0,
            customerPrice: row.customerPrice,
            mapPrice: row.mapPrice,
            updatePrice: true,
          });
        }
      } catch (productsError) {
        source = "inventory";
        const message =
          productsError instanceof Error
            ? productsError.message
            : String(productsError);
        warning = `Stock updated via Inventory (qty only). Products price refresh failed: ${message}`;
        const rows = await this.client.listInventory();
        for (const row of rows) {
          updated += await this.applyVariantStockPrice(tenantId, {
            skuId: row.skuID_Master,
            sku: row.sku,
            qty: row.qty ?? 0,
            updatePrice: false,
          });
        }
      }

      await this.recomputeProductQty(tenantId);

      await this.db
        .update(syncRuns)
        .set({
          status: warning ? "completed_with_errors" : "completed",
          skusUpserted: updated,
          rateLimitRemaining: this.client.rateLimitRemaining,
          errorSummary: warning,
          details: { source, errorCount: warning ? 1 : 0 },
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));

      return { id: run.id, updated, source };
    } catch (error) {
      await this.db
        .update(syncRuns)
        .set({
          status: "failed",
          errorSummary: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));
      throw error;
    }
  }

  private async applyVariantStockPrice(
    tenantId: string,
    input: {
      skuId?: number;
      sku?: string;
      qty: number;
      customerPrice?: number;
      mapPrice?: number;
      updatePrice: boolean;
    },
  ): Promise<number> {
    const patch: {
      qty: number;
      updatedAt: Date;
      customerPriceMinor?: number;
      mapPriceMinor?: number | null;
    } = {
      qty: input.qty,
      updatedAt: new Date(),
    };
    if (input.updatePrice) {
      patch.customerPriceMinor = dollarsToMinor(input.customerPrice);
      patch.mapPriceMinor =
        input.mapPrice == null ? null : dollarsToMinor(input.mapPrice);
    }

    if (input.skuId != null) {
      const result = await this.db
        .update(ssVariants)
        .set(patch)
        .where(
          and(
            eq(ssVariants.tenantId, tenantId),
            eq(ssVariants.vendor, VENDOR),
            eq(ssVariants.skuId, input.skuId),
          ),
        )
        .returning({ id: ssVariants.id });
      return result.length ? 1 : 0;
    }
    if (input.sku) {
      const result = await this.db
        .update(ssVariants)
        .set(patch)
        .where(
          and(
            eq(ssVariants.tenantId, tenantId),
            eq(ssVariants.vendor, VENDOR),
            eq(ssVariants.sku, input.sku),
          ),
        )
        .returning({ id: ssVariants.id });
      return result.length ? 1 : 0;
    }
    return 0;
  }

  private async getSettings(tenantId: string) {
    const [row] = await this.db
      .select()
      .from(catalogSettings)
      .where(eq(catalogSettings.tenantId, tenantId))
      .limit(1);
    return row;
  }

  private async markStyleInactive(tenantId: string, styleId: number) {
    await this.db
      .update(ssStyles)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, VENDOR),
          eq(ssStyles.styleId, styleId),
        ),
      );
    await this.db
      .update(ssProducts)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.vendor, VENDOR),
          eq(ssProducts.styleId, styleId),
        ),
      );
  }

  /**
   * Bulk `/v2/specs/` first (one request). If that fails, batch by style id.
   * Inventory sync does not call this. A total miss leaves `loaded: false`
   * so we do not wipe specs that were stored on a previous run.
   */
  private async loadSpecsIndex(styleIds: number[]): Promise<SpecsIndex> {
    const empty: SpecsIndex = { loaded: false, byStyle: new Map() };
    if (styleIds.length === 0) return { loaded: true, byStyle: new Map() };
    try {
      return { loaded: true, byStyle: groupSpecsByStyleId(await this.client.listSpecs()) };
    } catch {
      try {
        return {
          loaded: true,
          byStyle: groupSpecsByStyleId(
            await this.client.listSpecsByStyles(styleIds),
          ),
        };
      } catch {
        return empty;
      }
    }
  }

  private async persistStyleSizeSpecs(
    styleUuid: string,
    rows: SsSizeSpecRow[],
  ) {
    try {
      await this.db
        .update(ssStyles)
        .set({ sizeSpecs: rows, updatedAt: new Date() })
        .where(eq(ssStyles.id, styleUuid));
    } catch (error) {
      if (isMissingColumn(error, "size_specs")) return;
      throw error;
    }
  }

  private async upsertStyleTree(
    tenantId: string,
    style: SsStyle,
    actor: Actor,
    specsIndex?: SpecsIndex,
  ) {
    const ssCategories = normalizeCategories(style.categories, style.baseCategory);
    const brandImageUrl = await this.images.ensure(style.brandImage);
    const styleImageUrl = await this.images.ensure(style.styleImage);
    let imagesDownloaded = 0;
    if (brandImageUrl) imagesDownloaded += 1;
    if (styleImageUrl) imagesDownloaded += 1;

    const [existing] = await this.db
      .select({
        id: ssStyles.id,
        modelStatus: ssStyles.modelStatus,
      })
      .from(ssStyles)
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, VENDOR),
          eq(ssStyles.styleId, style.styleID),
        ),
      )
      .limit(1);

    const styleValues = {
      tenantId,
      vendor: VENDOR,
      externalKey: String(style.styleID),
      styleId: style.styleID,
      partNumber: style.partNumber ?? null,
      brandName: style.brandName,
      styleName: style.styleName,
      title: style.title ?? null,
      description: style.description ?? null,
      baseCategory: style.baseCategory ?? null,
      ssCategories,
      brandImagePath: style.brandImage ?? null,
      styleImagePath: style.styleImage ?? null,
      brandImageUrl,
      styleImageUrl,
      active: true,
      modelStatus: existing?.modelStatus ?? "none",
      updatedAt: new Date(),
      createdBy: actor,
      source: { system: "vendor" as const },
    };

    let styleRow = existing;
    if (existing) {
      const [updated] = await this.db
        .update(ssStyles)
        .set(styleValues)
        .where(eq(ssStyles.id, existing.id))
        .returning({ id: ssStyles.id, modelStatus: ssStyles.modelStatus });
      styleRow = updated ?? existing;
    } else {
      const [created] = await this.db
        .insert(ssStyles)
        .values(styleValues)
        .returning({ id: ssStyles.id, modelStatus: ssStyles.modelStatus });
      styleRow = created!;
      await this.db.insert(vendorMappings).values({
        tenantId,
        vendor: VENDOR,
        entityType: "style",
        entityId: styleRow.id,
        externalId: String(style.styleID),
        metadata: {},
        createdBy: actor,
        source: { system: "vendor" },
      });
      // Phase 2: leave model_status none (no-op enqueue)
    }

    if (specsIndex?.loaded) {
      await this.persistStyleSizeSpecs(
        styleRow!.id,
        specsIndex.byStyle.get(style.styleID) ?? [],
      );
    }

    let skus: SsProductSku[] = [];
    try {
      skus = await this.client.listProductsByStyle(style.styleID);
    } catch (error) {
      if (error instanceof SsNotFoundError) {
        await this.markStyleInactive(tenantId, style.styleID);
        return { skusUpserted: 0, imagesDownloaded };
      }
      throw error;
    }

    let skusUpserted = 0;
    const byColor = groupSkusByColor(skus);
    for (const [colorName, colorSkus] of byColor) {
      const sample = colorSkus[0]!;
      const front = await this.images.ensure(sample.colorFrontImage);
      const side = await this.images.ensure(sample.colorSideImage);
      const back = await this.images.ensure(sample.colorBackImage);
      const swatch = await this.images.ensure(sample.colorSwatchImage);
      for (const url of [front, side, back, swatch]) {
        if (url) imagesDownloaded += 1;
      }

      const slug = slugify(
        style.brandName,
        style.styleName,
        colorName,
        String(style.styleID),
      );
      const qty = colorSkus.reduce((sum, sku) => sum + (sku.qty ?? 0), 0);
      const [existingProduct] = await this.db
        .select()
        .from(ssProducts)
        .where(
          and(
            eq(ssProducts.tenantId, tenantId),
            eq(ssProducts.vendor, VENDOR),
            eq(ssProducts.styleId, style.styleID),
            eq(ssProducts.colorName, colorName),
          ),
        )
        .limit(1);

      const productValues = {
        tenantId,
        vendor: VENDOR,
        styleUuid: styleRow!.id,
        styleId: style.styleID,
        colorName,
        colorCode: sample.colorCode ?? null,
        color1: sample.color1 ?? null,
        color2: sample.color2 ?? null,
        isDark: existingProduct?.isDark ?? isDarkHex(sample.color1),
        colorFrontImagePath: sample.colorFrontImage ?? null,
        colorSideImagePath: sample.colorSideImage ?? null,
        colorBackImagePath: sample.colorBackImage ?? null,
        colorSwatchImagePath: sample.colorSwatchImage ?? null,
        colorFrontImageUrl: front,
        colorSideImageUrl: side,
        colorBackImageUrl: back,
        colorSwatchImageUrl: swatch,
        materialConfig: {
          baseColor: sample.color1 ?? null,
          accentColor: sample.color2 ?? null,
        },
        qty,
        // Vendor sellable flag only. Staff soft-hide is storefront_visible —
        // never included here so sync cannot un-hide a colorway.
        active: true,
        slug: existingProduct?.slug ?? slug,
        updatedAt: new Date(),
        createdBy: actor,
        source: { system: "vendor" as const },
      };

      let productRow = existingProduct;
      if (existingProduct) {
        const [updated] = await this.db
          .update(ssProducts)
          .set(productValues)
          .where(eq(ssProducts.id, existingProduct.id))
          .returning();
        productRow = updated ?? existingProduct;
      } else {
        const [created] = await this.db
          .insert(ssProducts)
          .values(productValues)
          .returning();
        productRow = created!;
        await this.db.insert(vendorMappings).values({
          tenantId,
          vendor: VENDOR,
          entityType: "product",
          entityId: productRow.id,
          externalId: `${style.styleID}:${colorName}`,
          metadata: {},
          createdBy: actor,
          source: { system: "vendor" },
        });
      }

      await this.assignCategories(tenantId, productRow!.id, ssCategories, style);

      for (const sku of colorSkus) {
        const [existingVariant] = await this.db
          .select()
          .from(ssVariants)
          .where(
            and(
              eq(ssVariants.tenantId, tenantId),
              eq(ssVariants.vendor, VENDOR),
              eq(ssVariants.skuId, sku.skuID_Master),
            ),
          )
          .limit(1);
        const variantValues = {
          tenantId,
          vendor: VENDOR,
          externalKey: String(sku.skuID_Master),
          productUuid: productRow!.id,
          skuId: sku.skuID_Master,
          sku: sku.sku,
          gtin: sku.gtin ?? null,
          sizeName: sku.sizeName,
          sizeCode: sku.sizeCode ?? null,
          sizeOrder: parseSizeOrder(sku.sizeOrder),
          customerPriceMinor: dollarsToMinor(sku.customerPrice),
          mapPriceMinor:
            sku.mapPrice == null ? null : dollarsToMinor(sku.mapPrice),
          qty: sku.qty ?? 0,
          active: true,
          updatedAt: new Date(),
          createdBy: actor,
          source: { system: "vendor" as const },
        };
        if (existingVariant) {
          await this.db
            .update(ssVariants)
            .set(variantValues)
            .where(eq(ssVariants.id, existingVariant.id));
        } else {
          const [created] = await this.db
            .insert(ssVariants)
            .values(variantValues)
            .returning();
          await this.db.insert(vendorMappings).values({
            tenantId,
            vendor: VENDOR,
            entityType: "variant",
            entityId: created!.id,
            externalId: String(sku.skuID_Master),
            metadata: { sku: sku.sku },
            createdBy: actor,
            source: { system: "vendor" },
          });
        }
        skusUpserted += 1;
      }
    }

    return { skusUpserted, imagesDownloaded };
  }

  private async assignCategories(
    tenantId: string,
    productUuid: string,
    ssCategories: string[],
    style: SsStyle,
  ) {
    const overrides = await this.db
      .select()
      .from(categoryOverrides)
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

    if (overrides.length > 0) {
      for (const override of overrides) {
        await this.db.insert(ssProductCategories).values({
          tenantId,
          productUuid,
          categoryId: override.categoryId,
          assignmentSource: "override",
        });
      }
      return;
    }

    const mappedIds = new Set<string>();
    for (const key of ssCategories) {
      const maps = await this.db
        .select()
        .from(ssCategoryMap)
        .where(
          and(
            eq(ssCategoryMap.tenantId, tenantId),
            eq(ssCategoryMap.ssCategoryKey, key),
          ),
        );
      for (const map of maps) mappedIds.add(map.categoryId);
    }

    if (mappedIds.size === 0) {
      const text = `${style.styleName} ${style.title ?? ""} ${style.baseCategory ?? ""}`;
      const candidates = fallbackCategorySlugs(text);
      if (candidates.length > 0) {
        const { categories } = await import("../../db/schema.js");
        const found = await this.db
          .select({ id: categories.id, slug: categories.slug })
          .from(categories)
          .where(
            and(
              eq(categories.tenantId, tenantId),
              inArray(categories.slug, candidates),
            ),
          );
        const bySlug = new Map(found.map((row) => [row.slug, row.id]));
        const best = candidates.map((slug) => bySlug.get(slug)).find(Boolean);
        if (best) mappedIds.add(best);
      }
    }

    if (mappedIds.size === 0) {
      for (const key of ssCategories.length ? ssCategories : ["uncategorized"]) {
        const [existingUnmapped] = await this.db
          .select()
          .from(ssUnmappedCategories)
          .where(
            and(
              eq(ssUnmappedCategories.tenantId, tenantId),
              eq(ssUnmappedCategories.ssCategoryKey, key),
            ),
          )
          .limit(1);
        if (!existingUnmapped) {
          await this.db.insert(ssUnmappedCategories).values({
            tenantId,
            ssCategoryKey: key,
            ssCategoryLabel: key,
            styleCount: 1,
            sampleStyleIds: [style.styleID],
          });
        } else {
          const samples = new Set([
            ...(existingUnmapped.sampleStyleIds ?? []),
            style.styleID,
          ]);
          await this.db
            .update(ssUnmappedCategories)
            .set({
              styleCount: existingUnmapped.styleCount + 1,
              sampleStyleIds: [...samples].slice(0, 20),
              updatedAt: new Date(),
            })
            .where(eq(ssUnmappedCategories.id, existingUnmapped.id));
        }
      }
      return;
    }

    for (const categoryId of mappedIds) {
      await this.db.insert(ssProductCategories).values({
        tenantId,
        productUuid,
        categoryId,
          assignmentSource: "map",
      });
    }
  }

  private async refreshUnmapped(tenantId: string) {
    const mappedKeys = await this.db
      .select({ key: ssCategoryMap.ssCategoryKey })
      .from(ssCategoryMap)
      .where(eq(ssCategoryMap.tenantId, tenantId));
    const keys = mappedKeys.map((row) => row.key);
    if (keys.length === 0) return;
    await this.db
      .delete(ssUnmappedCategories)
      .where(
        and(
          eq(ssUnmappedCategories.tenantId, tenantId),
          inArray(ssUnmappedCategories.ssCategoryKey, keys),
        ),
      );
  }

  private async recomputeProductQty(tenantId: string) {
    await this.db.execute(sql`
      update ss_products p
      set qty = coalesce((
        select sum(v.qty)::int from ss_variants v
        where v.product_uuid = p.id and v.tenant_id = p.tenant_id and v.active = true
      ), 0),
      updated_at = now()
      where p.tenant_id = ${tenantId}
    `);
  }
}
