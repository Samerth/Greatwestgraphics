import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../../db/client.js";
import {
  categories,
  categoryOverrides,
  ssCategoryMap,
  ssProductCategories,
  ssProducts,
  ssStyleColumnsWithoutSizeSpecs,
  ssStyles,
  ssUnmappedCategories,
  ssVariants,
  syncRuns,
  vendorMappings,
} from "../../db/schema.js";
import {
  dollarsToMinor,
  isDarkHex,
  parseSizeOrder,
  slugify,
} from "../ss-activewear/client.js";
import { externalKeyToNumericId } from "./ids.js";
import type { CatalogSkuRow, InventoryRow, SyncRunResult } from "./types.js";

/**
 * Last-resort categorisation for vendor rows that arrive with no category of
 * their own. Order is significant: the first match wins, so the specific
 * garments sit above the general ones -- a hi-vis vest belongs under safety
 * rather than vests, and a quarter-zip is a sweatshirt before it is a jacket.
 *
 * Every pattern is anchored on word boundaries. Without them `hat` matched any
 * product whose name merely contained those letters, and `bag` filed "baggy"
 * under tote bags.
 */
export const KEYWORD_FALLBACKS: Array<{ pattern: RegExp; categorySlug: string }> = [
  // Safety first: hi-vis outerwear names itself after the garment it replaces,
  // so "safety vest" and "hi-vis jacket" would otherwise land in vests/jackets.
  {
    pattern: /\b(hi[- ]?vis|high[- ]?visibility|reflective|ansi|safety)\b/i,
    categorySlug: "safety",
  },
  {
    pattern:
      /\b(hoodie|hooded|crewneck|sweatshirt|sweater|fleece|pullover|quarter[- ]?zip|1\/4[- ]?zip|half[- ]?zip|1\/2[- ]?zip)\b/i,
    categorySlug: "hoodies-and-crewnecks",
  },
  { pattern: /\b(tee|tees|t-shirt|tshirt|t shirt)\b/i, categorySlug: "t-shirts" },
  {
    pattern: /\b(hat|hats|cap|caps|beanie|toque|visor|snapback|trucker)\b/i,
    categorySlug: "hats",
  },
  {
    pattern: /\b(tote|bag|bags|backpack|duffel|duffle|cinch|pack)\b/i,
    categorySlug: "tote-bags",
  },
  { pattern: /\b(jacket|parka|windbreaker|shell|anorak)\b/i, categorySlug: "jackets" },
  { pattern: /\b(vest|bodywarmer|gilet)\b/i, categorySlug: "vests" },
  { pattern: /\b(jersey|jerseys)\b/i, categorySlug: "jerseys" },
  { pattern: /\b(polo|polos)\b/i, categorySlug: "polos" },
  { pattern: /\b(sock|socks)\b/i, categorySlug: "socks" },
  {
    pattern: /\b(tumbler|mug|bottle|drinkware|flask|growler|can cooler)\b/i,
    categorySlug: "drinkware",
  },
  { pattern: /\b(notebook|journal|notepad|planner)\b/i, categorySlug: "notebooks" },
  { pattern: /\b(patch|patches)\b/i, categorySlug: "patches" },
];

/**
 * Every fallback category a product's text suggests, best match first.
 *
 * All the candidates are returned rather than just the winner because a tenant
 * need not have every category: the caller keeps walking the list until it
 * finds one that exists, which is what the original per-rule query did.
 *
 * Separated from the database write so the rules can be exercised directly --
 * the ordering between overlapping rules is the part most likely to regress.
 */
export function fallbackCategorySlugs(searchText: string): string[] {
  const slugs: string[] = [];
  for (const rule of KEYWORD_FALLBACKS) {
    if (rule.pattern.test(searchText) && !slugs.includes(rule.categorySlug)) {
      slugs.push(rule.categorySlug);
    }
  }
  return slugs;
}

/**
 * Shared catalog upsert used by every vendor adapter (S&S wrapper, Sanmar, CSV).
 * Writes into the unified ss_* tables with a vendor namespace.
 */
export class CatalogWriter {
  constructor(private readonly db: CommerceDatabase) {}

  async beginRun(
    tenantId: string,
    vendor: string,
    type: SyncRunResult["type"],
    actor: Actor,
  ) {
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        vendor,
        type,
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api" },
      })
      .returning();
    if (!run) throw new Error("Failed to create sync run");
    return run;
  }

  async finishRun(
    runId: string,
    result: Omit<SyncRunResult, "id" | "vendor" | "type"> & {
      rateLimitRemaining?: number | null;
    },
  ) {
    await this.db
      .update(syncRuns)
      .set({
        status: result.status,
        stylesProcessed: result.stylesProcessed,
        skusUpserted: result.skusUpserted,
        imagesDownloaded: result.imagesDownloaded,
        rateLimitRemaining: result.rateLimitRemaining ?? null,
        errorSummary: result.errors.slice(0, 20).join("\n") || null,
        details: { errorCount: result.errors.length },
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncRuns.id, runId));
  }

  async failRun(runId: string, error: unknown) {
    await this.db
      .update(syncRuns)
      .set({
        status: "failed",
        errorSummary: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(syncRuns.id, runId));
  }

  /** Periodic counter updates while a long upsert is still running. */
  async updateRunProgress(
    runId: string,
    progress: { stylesProcessed: number; skusUpserted: number },
  ) {
    await this.db
      .update(syncRuns)
      .set({
        stylesProcessed: progress.stylesProcessed,
        skusUpserted: progress.skusUpserted,
        updatedAt: new Date(),
      })
      .where(eq(syncRuns.id, runId));
  }

  /**
   * Upsert a flat list of SKU rows. Groups by style then color.
   * Use `fast: true` for large sellable imports (batched ON CONFLICT, no
   * per-row mappings/categories).
   */
  async upsertSkuRows(
    tenantId: string,
    vendor: string,
    rows: CatalogSkuRow[],
    actor: Actor,
    options?: {
      onProgress?: (progress: {
        stylesProcessed: number;
        skusUpserted: number;
      }) => void | Promise<void>;
      /** Emit onProgress every N styles (default 25). */
      progressEvery?: number;
      /** Batched upserts for large catalogs (Sanmar sellable, etc.). */
      fast?: boolean;
    },
  ): Promise<{ stylesProcessed: number; skusUpserted: number; errors: string[] }> {
    if (options?.fast) {
      return this.upsertSkuRowsFast(tenantId, vendor, rows, actor, options);
    }

    const byStyle = new Map<string, CatalogSkuRow[]>();
    for (const row of rows) {
      const key = row.styleKey.trim();
      if (!key) continue;
      const list = byStyle.get(key) ?? [];
      list.push(row);
      byStyle.set(key, list);
    }

    let stylesProcessed = 0;
    let skusUpserted = 0;
    const errors: string[] = [];
    const progressEvery = options?.progressEvery ?? 25;

    for (const [styleKey, styleRows] of byStyle) {
      try {
        const result = await this.upsertStyleTree(
          tenantId,
          vendor,
          styleKey,
          styleRows,
          actor,
        );
        stylesProcessed += 1;
        skusUpserted += result.skusUpserted;
        if (
          options?.onProgress &&
          (stylesProcessed % progressEvery === 0 ||
            stylesProcessed === byStyle.size)
        ) {
          await options.onProgress({ stylesProcessed, skusUpserted });
        }
      } catch (error) {
        errors.push(
          `style ${styleKey}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await this.recomputeProductQty(tenantId, vendor);
    return { stylesProcessed, skusUpserted, errors };
  }

  /**
   * High-throughput upsert for large catalogs. Batches styles/products/variants
   * with ON CONFLICT; skips vendor_mappings and category assignment.
   */
  private async upsertSkuRowsFast(
    tenantId: string,
    vendor: string,
    rows: CatalogSkuRow[],
    actor: Actor,
    options?: {
      onProgress?: (progress: {
        stylesProcessed: number;
        skusUpserted: number;
      }) => void | Promise<void>;
    },
  ): Promise<{ stylesProcessed: number; skusUpserted: number; errors: string[] }> {
    const byStyle = new Map<string, CatalogSkuRow[]>();
    for (const row of rows) {
      const key = row.styleKey.trim();
      if (!key) continue;
      const list = byStyle.get(key) ?? [];
      list.push(row);
      byStyle.set(key, list);
    }

    const errors: string[] = [];
    const styleKeys = [...byStyle.keys()];
    const now = new Date();

    const chunk = <T>(items: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
      return out;
    };

    for (const keys of chunk(styleKeys, 100)) {
        const values = keys.map((styleKey) => {
          const sample = byStyle.get(styleKey)![0]!;
          return {
            tenantId,
            vendor,
            externalKey: styleKey,
            styleId: externalKeyToNumericId(`${vendor}:${styleKey}`),
            partNumber: styleKey,
            brandName: sample.brandName || "Unknown",
            styleName: sample.styleName || styleKey,
            title: sample.title ?? null,
            description: sample.description ?? null,
            baseCategory: sample.category?.split(/[,|;]/)[0]?.trim() || null,
            ssCategories: sample.category
              ? sample.category.split(/[,|;]/).map((c) => c.trim()).filter(Boolean)
              : [],
            styleImageUrl: sample.imageFront ?? null,
            active: true,
            modelStatus: "none" as const,
            updatedAt: now,
            createdBy: actor,
            source: { system: "vendor" as const },
          };
        });

    await this.db
          .insert(ssStyles)
          .values(values)
          .onConflictDoUpdate({
            target: [ssStyles.tenantId, ssStyles.vendor, ssStyles.styleId],
            set: {
              externalKey: sql`excluded.external_key`,
              partNumber: sql`excluded.part_number`,
              brandName: sql`excluded.brand_name`,
              styleName: sql`excluded.style_name`,
              title: sql`excluded.title`,
              description: sql`excluded.description`,
              baseCategory: sql`excluded.base_category`,
              ssCategories: sql`excluded.ss_categories`,
              styleImageUrl: sql`excluded.style_image_url`,
              active: sql`excluded.active`,
              updatedAt: now,
            },
          });
    }

    if (options?.onProgress) {
      await options.onProgress({
        stylesProcessed: styleKeys.length,
        skusUpserted: 0,
      });
    }

    const styleRows = await this.db
      .select({
        id: ssStyles.id,
        styleId: ssStyles.styleId,
        externalKey: ssStyles.externalKey,
      })
      .from(ssStyles)
      .where(and(eq(ssStyles.tenantId, tenantId), eq(ssStyles.vendor, vendor)));

    const styleByKey = new Map(
      styleRows
        .filter((s) => s.externalKey)
        .map((s) => [s.externalKey!, s]),
    );

    type ProductInsert = {
      tenantId: string;
      vendor: string;
      styleUuid: string;
      styleId: number;
      colorName: string;
      colorCode: string | null;
      color1: string | null;
      isDark: boolean;
      colorFrontImageUrl: string | null;
      colorSideImageUrl: string | null;
      colorBackImageUrl: string | null;
      colorSwatchImageUrl: string | null;
      materialConfig: Record<string, unknown>;
      qty: number;
      /** Vendor sellable flag only — never staff soft-hide. */
      active: boolean;
      slug: string;
      updatedAt: Date;
      createdBy: Actor;
      source: { system: "vendor" };
      // Intentionally omit storefrontVisible / hiddenAt / hiddenBy so inserts
      // use DB defaults and conflict updates never clobber staff soft-hide.
    };

    const productValues: ProductInsert[] = [];
    const seenProductKeys = new Set<string>();
    const seenSlugs = new Set<string>();
    for (const [styleKey, styleSkuRows] of byStyle) {
      const style = styleByKey.get(styleKey);
      if (!style) {
        errors.push(`style ${styleKey}: missing after style upsert`);
        continue;
      }
      // Case-insensitive color merge (sellable feeds often repeat casing).
      const byColor = new Map<string, { display: string; rows: CatalogSkuRow[] }>();
      for (const row of styleSkuRows) {
        const display = row.colorName?.trim() || "Unknown";
        const key = display.toLowerCase();
        const existing = byColor.get(key);
        if (existing) existing.rows.push(row);
        else byColor.set(key, { display, rows: [row] });
      }
      for (const { display: colorName, rows: colorRows } of byColor.values()) {
        const productKey = `${style.styleId}::${colorName.toLowerCase()}`;
        if (seenProductKeys.has(productKey)) continue;
        seenProductKeys.add(productKey);
        const colorSample = colorRows[0]!;
        const colorHash = externalKeyToNumericId(
          `${vendor}:${styleKey}:${colorName.toLowerCase()}`,
        ).toString(36);
        // Keep hash at the end after truncation so long color names cannot
        // collide under the tenant-wide slug unique index.
        const base = slugify(vendor, styleKey, String(style.styleId), colorName).slice(
          0,
          100,
        );
        let slug = `${base}-${colorHash}`.slice(0, 120);
        if (seenSlugs.has(slug)) {
          slug = `${base}-${colorHash}-${seenSlugs.size}`.slice(0, 120);
        }
        seenSlugs.add(slug);
        productValues.push({
          tenantId,
          vendor,
          styleUuid: style.id,
          styleId: style.styleId,
          colorName,
          colorCode: colorSample.colorCode ?? null,
          color1: colorSample.colorHex ?? null,
          isDark: isDarkHex(colorSample.colorHex ?? undefined),
          colorFrontImageUrl: colorSample.imageFront ?? null,
          colorSideImageUrl: colorSample.imageSide ?? null,
          colorBackImageUrl: colorSample.imageBack ?? null,
          colorSwatchImageUrl: colorSample.imageSwatch ?? null,
          materialConfig: { baseColor: colorSample.colorHex ?? null },
          qty: colorRows.reduce((sum, r) => sum + (r.qty ?? 0), 0),
          active: true,
          slug,
          updatedAt: now,
          createdBy: actor,
          source: { system: "vendor" },
        });
      }
    }

    for (const batch of chunk(productValues, 200)) {
      await this.db
        .insert(ssProducts)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            ssProducts.tenantId,
            ssProducts.vendor,
            ssProducts.styleId,
            ssProducts.colorName,
          ],
          set: {
            styleUuid: sql`excluded.style_uuid`,
            colorCode: sql`excluded.color_code`,
            color1: sql`excluded.color1`,
            colorFrontImageUrl: sql`excluded.color_front_image_url`,
            colorSideImageUrl: sql`excluded.color_side_image_url`,
            colorBackImageUrl: sql`excluded.color_back_image_url`,
            colorSwatchImageUrl: sql`excluded.color_swatch_image_url`,
            qty: sql`excluded.qty`,
            // Vendor discontinued flag only. Never touch storefront_visible,
            // hidden_at, hidden_by, is_dark, or slug (staff/editorial fields).
            active: sql`excluded.active`,
            updatedAt: now,
          },
        });
    }

    if (options?.onProgress) {
      await options.onProgress({
        stylesProcessed: styleKeys.length,
        skusUpserted: 0,
      });
    }

    const productRows = await this.db
      .select({
        id: ssProducts.id,
        styleId: ssProducts.styleId,
        colorName: ssProducts.colorName,
      })
      .from(ssProducts)
      .where(
        and(eq(ssProducts.tenantId, tenantId), eq(ssProducts.vendor, vendor)),
      );

    const productByStyleColor = new Map(
      productRows.map((p) => [`${p.styleId}::${p.colorName.toLowerCase()}`, p.id]),
    );

    type VariantInsert = {
      tenantId: string;
      vendor: string;
      externalKey: string;
      productUuid: string;
      skuId: number;
      sku: string;
      gtin: string | null;
      sizeName: string;
      sizeCode: string | null;
      sizeOrder: number;
      customerPriceMinor: number;
      mapPriceMinor: number | null;
      qty: number;
      active: boolean;
      updatedAt: Date;
      createdBy: Actor;
      source: { system: "vendor" };
    };

    const variantValues: VariantInsert[] = [];
    const seenSkuIds = new Set<number>();
    for (const [styleKey, styleSkuRows] of byStyle) {
      const style = styleByKey.get(styleKey);
      if (!style) continue;
      for (const row of styleSkuRows) {
        const skuKey = row.skuKey.trim();
        if (!skuKey) continue;
        const colorName = row.colorName?.trim() || "Unknown";
        const productUuid = productByStyleColor.get(
          `${style.styleId}::${colorName.toLowerCase()}`,
        );
        if (!productUuid) {
          errors.push(`sku ${skuKey}: missing product ${styleKey}/${colorName}`);
          continue;
        }
        const skuId = externalKeyToNumericId(`${vendor}:${skuKey}`);
        if (seenSkuIds.has(skuId)) {
          errors.push(`sku ${skuKey}: numeric id collision, skipped`);
          continue;
        }
        seenSkuIds.add(skuId);
        variantValues.push({
          tenantId,
          vendor,
          externalKey: skuKey,
          productUuid,
          skuId,
          sku: row.sku || skuKey,
          gtin: row.gtin ?? null,
          sizeName: row.sizeName || "OSFA",
          sizeCode: row.sizeCode ?? null,
          sizeOrder: row.sizeOrder ?? parseSizeOrder(row.sizeCode) ?? 0,
          customerPriceMinor: dollarsToMinor(row.priceDollars),
          mapPriceMinor:
            row.mapPriceDollars == null
              ? null
              : dollarsToMinor(row.mapPriceDollars),
          qty: row.qty ?? 0,
          active: true,
          updatedAt: now,
          createdBy: actor,
          source: { system: "vendor" },
        });
      }
    }

    let skusUpserted = 0;
    for (const batch of chunk(variantValues, 500)) {
      await this.db
        .insert(ssVariants)
        .values(batch)
        .onConflictDoUpdate({
          target: [ssVariants.tenantId, ssVariants.vendor, ssVariants.skuId],
          set: {
            externalKey: sql`excluded.external_key`,
            productUuid: sql`excluded.product_uuid`,
            sku: sql`excluded.sku`,
            gtin: sql`excluded.gtin`,
            sizeName: sql`excluded.size_name`,
            sizeCode: sql`excluded.size_code`,
            sizeOrder: sql`excluded.size_order`,
            customerPriceMinor: sql`excluded.customer_price_minor`,
            mapPriceMinor: sql`excluded.map_price_minor`,
            qty: sql`excluded.qty`,
            active: sql`excluded.active`,
            updatedAt: now,
          },
        });
      skusUpserted += batch.length;
      if (options?.onProgress) {
        await options.onProgress({
          stylesProcessed: styleKeys.length,
          skusUpserted,
        });
      }
    }

    await this.recomputeProductQty(tenantId, vendor);
    return {
      stylesProcessed: styleKeys.length,
      skusUpserted,
      errors,
    };
  }

  /**
   * Patch style metadata after a sellable-first import (names/brands/images
   * from getProduct). Leaves products/variants untouched.
   */
  async patchStyleMetadata(
    tenantId: string,
    vendor: string,
    patches: Array<{
      styleKey: string;
      brandName?: string | null;
      styleName?: string | null;
      title?: string | null;
      description?: string | null;
      category?: string | null;
      imageFront?: string | null;
    }>,
  ): Promise<number> {
    let updated = 0;
    for (const patch of patches) {
      const categoryKeys = patch.category
        ? patch.category.split(/[,|;]/).map((c) => c.trim()).filter(Boolean)
        : [];
      const result = await this.db
        .update(ssStyles)
        .set({
          ...(patch.brandName ? { brandName: patch.brandName } : {}),
          ...(patch.styleName ? { styleName: patch.styleName } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description }
            : {}),
          ...(categoryKeys[0] ? { baseCategory: categoryKeys[0] } : {}),
          ...(categoryKeys.length ? { ssCategories: categoryKeys } : {}),
          ...(patch.imageFront ? { styleImageUrl: patch.imageFront } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ssStyles.tenantId, tenantId),
            eq(ssStyles.vendor, vendor),
            eq(ssStyles.externalKey, patch.styleKey),
          ),
        )
        .returning({ id: ssStyles.id });
      if (result.length) updated += 1;
    }
    return updated;
  }

  /**
   * File a vendor's still-uncategorised products using the keyword fallbacks.
   *
   * The fast upsert path skips category assignment on purpose — it exists to
   * land tens of thousands of sellable rows quickly, and per-product category
   * queries are exactly what makes the slow path slow. That was survivable
   * while the fast path was only used for interim rows, but Sanmar's whole
   * catalogue goes through it, so every one of its products stayed
   * uncategorised no matter how good the keyword rules got.
   *
   * It runs as a separate pass rather than inside the upsert because a
   * sellable feed carries no product names: until enrichment has replaced the
   * placeholder style name with the real one there is no text to match on, and
   * matching too early would file everything under nothing and then leave it
   * there.
   *
   * Only products with no category at all are touched. A product that already
   * has a row was categorised by a vendor mapping or by staff, and guessing
   * over top of either would be worse than leaving it alone.
   */
  async assignFallbackCategories(
    tenantId: string,
    vendor: string,
  ): Promise<{ assigned: number; unmatched: number }> {
    const tenantCategories = await this.db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(eq(categories.tenantId, tenantId));
    const categoryIdBySlug = new Map(
      tenantCategories.map((row) => [row.slug, row.id]),
    );
    if (categoryIdBySlug.size === 0) return { assigned: 0, unmatched: 0 };

    const uncategorised = await this.db
      .select({
        productUuid: ssProducts.id,
        styleName: ssStyles.styleName,
        title: ssStyles.title,
        baseCategory: ssStyles.baseCategory,
      })
      .from(ssProducts)
      .innerJoin(ssStyles, eq(ssStyles.id, ssProducts.styleUuid))
      .leftJoin(
        ssProductCategories,
        eq(ssProductCategories.productUuid, ssProducts.id),
      )
      .where(
        and(
          eq(ssProducts.tenantId, tenantId),
          eq(ssProducts.vendor, vendor),
          isNull(ssProductCategories.id),
        ),
      );
    if (uncategorised.length === 0) return { assigned: 0, unmatched: 0 };

    // A staff override means the product is deliberately filed somewhere, even
    // if the join above found no row yet to prove it.
    const overrides = await this.db
      .select({ productUuid: categoryOverrides.productUuid })
      .from(categoryOverrides)
      .where(eq(categoryOverrides.tenantId, tenantId));
    const overridden = new Set(overrides.map((row) => row.productUuid));

    const values: Array<{
      tenantId: string;
      productUuid: string;
      categoryId: string;
      assignmentSource: string;
    }> = [];
    let unmatched = 0;

    for (const row of uncategorised) {
      if (overridden.has(row.productUuid)) continue;
      const searchText = [row.styleName, row.title, row.baseCategory]
        .filter(Boolean)
        .join(" ");
      const categoryId = fallbackCategorySlugs(searchText)
        .map((slug) => categoryIdBySlug.get(slug))
        .find(Boolean);
      if (!categoryId) {
        unmatched += 1;
        continue;
      }
      values.push({
        tenantId,
        productUuid: row.productUuid,
        categoryId,
        assignmentSource: "map",
      });
    }

    for (let i = 0; i < values.length; i += 500) {
      await this.db.insert(ssProductCategories).values(values.slice(i, i + 500));
    }

    return { assigned: values.length, unmatched };
  }

  async updateInventory(
    tenantId: string,
    vendor: string,
    items: InventoryRow[],
  ): Promise<{ updated: number; errors: string[] }> {
    let updated = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const patch: {
          qty: number;
          customerPriceMinor?: number;
          updatedAt: Date;
        } = {
          qty: item.qty,
          updatedAt: new Date(),
        };
        if (item.priceDollars != null) {
          patch.customerPriceMinor = dollarsToMinor(item.priceDollars);
        }

        if (item.skuKey) {
          const result = await this.db
            .update(ssVariants)
            .set(patch)
            .where(
              and(
                eq(ssVariants.tenantId, tenantId),
                eq(ssVariants.vendor, vendor),
                eq(ssVariants.externalKey, item.skuKey),
              ),
            )
            .returning({ id: ssVariants.id });
          if (result.length) {
            updated += 1;
            continue;
          }
        }

        if (item.sku) {
          const result = await this.db
            .update(ssVariants)
            .set(patch)
            .where(
              and(
                eq(ssVariants.tenantId, tenantId),
                eq(ssVariants.vendor, vendor),
                eq(ssVariants.sku, item.sku),
              ),
            )
            .returning({ id: ssVariants.id });
          if (result.length) updated += 1;
        }
      } catch (error) {
        errors.push(
          `inventory ${item.skuKey ?? item.sku}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    await this.recomputeProductQty(tenantId, vendor);
    return { updated, errors };
  }

  private async upsertStyleTree(
    tenantId: string,
    vendor: string,
    styleKey: string,
    rows: CatalogSkuRow[],
    actor: Actor,
  ) {
    const sample = rows[0]!;
    const numericStyleId = externalKeyToNumericId(`${vendor}:${styleKey}`);
    const categoryKeys = sample.category
      ? sample.category.split(/[,|;]/).map((c) => c.trim()).filter(Boolean)
      : [];

    const styleColumns = ssStyleColumnsWithoutSizeSpecs();
    const [existing] = await this.db
      .select(styleColumns)
      .from(ssStyles)
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, vendor),
          eq(ssStyles.externalKey, styleKey),
        ),
      )
      .limit(1);

    const styleValues = {
      tenantId,
      vendor,
      externalKey: styleKey,
      styleId: existing?.styleId ?? numericStyleId,
      partNumber: styleKey,
      brandName: sample.brandName || "Unknown",
      styleName: sample.styleName || styleKey,
      title: sample.title ?? null,
      description: sample.description ?? null,
      baseCategory: categoryKeys[0] ?? null,
      ssCategories: categoryKeys,
      styleImageUrl: sample.imageFront ?? existing?.styleImageUrl ?? null,
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
        .returning(styleColumns);
      styleRow = updated ?? existing;
    } else {
      const [created] = await this.db
        .insert(ssStyles)
        .values(styleValues)
        .returning(styleColumns);
      styleRow = created!;
      await this.ensureMapping(
        tenantId,
        vendor,
        "style",
        styleRow.id,
        styleKey,
        actor,
        {},
      );
    }

    const byColor = new Map<string, CatalogSkuRow[]>();
    for (const row of rows) {
      const color = row.colorName?.trim() || "Unknown";
      const list = byColor.get(color) ?? [];
      list.push(row);
      byColor.set(color, list);
    }

    let skusUpserted = 0;
    for (const [colorName, colorRows] of byColor) {
      const colorSample = colorRows[0]!;
      const slug = slugify(
        sample.brandName,
        sample.styleName,
        colorName,
        vendor,
        styleKey,
      );
      const qty = colorRows.reduce((sum, r) => sum + (r.qty ?? 0), 0);

      const [existingProduct] = await this.db
        .select()
        .from(ssProducts)
        .where(
          and(
            eq(ssProducts.tenantId, tenantId),
            eq(ssProducts.vendor, vendor),
            eq(ssProducts.styleId, styleRow!.styleId),
            eq(ssProducts.colorName, colorName),
          ),
        )
        .limit(1);

      const productValues = {
        tenantId,
        vendor,
        styleUuid: styleRow!.id,
        styleId: styleRow!.styleId,
        colorName,
        colorCode: colorSample.colorCode ?? null,
        color1: colorSample.colorHex ?? null,
        isDark:
          existingProduct?.isDark ?? isDarkHex(colorSample.colorHex ?? undefined),
        colorFrontImageUrl:
          colorSample.imageFront ?? existingProduct?.colorFrontImageUrl ?? null,
        colorSideImageUrl:
          colorSample.imageSide ?? existingProduct?.colorSideImageUrl ?? null,
        colorBackImageUrl:
          colorSample.imageBack ?? existingProduct?.colorBackImageUrl ?? null,
        colorSwatchImageUrl:
          colorSample.imageSwatch ?? existingProduct?.colorSwatchImageUrl ?? null,
        materialConfig: {
          baseColor: colorSample.colorHex ?? null,
        },
        qty,
        active: true,
        slug: existingProduct?.slug ?? slug,
        updatedAt: new Date(),
        createdBy: actor,
        source: { system: "vendor" as const },
        // storefrontVisible / hiddenAt / hiddenBy intentionally omitted —
        // inserts default to visible; updates must never overwrite staff hide.
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
        await this.ensureMapping(
          tenantId,
          vendor,
          "product",
          productRow.id,
          `${styleKey}:${colorName}`,
          actor,
          {},
        );
      }

      await this.assignCategories(
        tenantId,
        productRow!.id,
        categoryKeys,
        `${sample.styleName} ${sample.title ?? ""} ${sample.category ?? ""}`,
        styleRow!.styleId,
      );

      for (const row of colorRows) {
        const skuKey = row.skuKey.trim();
        if (!skuKey) continue;
        const numericSkuId = externalKeyToNumericId(`${vendor}:${skuKey}`);

        const [existingVariant] = await this.db
          .select()
          .from(ssVariants)
          .where(
            and(
              eq(ssVariants.tenantId, tenantId),
              eq(ssVariants.vendor, vendor),
              eq(ssVariants.externalKey, skuKey),
            ),
          )
          .limit(1);

        const variantValues = {
          tenantId,
          vendor,
          externalKey: skuKey,
          productUuid: productRow!.id,
          skuId: existingVariant?.skuId ?? numericSkuId,
          sku: row.sku || skuKey,
          gtin: row.gtin ?? null,
          sizeName: row.sizeName || "OSFA",
          sizeCode: row.sizeCode ?? null,
          sizeOrder:
            row.sizeOrder ??
            parseSizeOrder(row.sizeCode) ??
            0,
          customerPriceMinor: dollarsToMinor(row.priceDollars),
          mapPriceMinor:
            row.mapPriceDollars == null
              ? null
              : dollarsToMinor(row.mapPriceDollars),
          qty: row.qty ?? 0,
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
          await this.ensureMapping(
            tenantId,
            vendor,
            "variant",
            created!.id,
            skuKey,
            actor,
            { sku: row.sku },
          );
        }
        skusUpserted += 1;
      }
    }

    return { skusUpserted };
  }

  private async ensureMapping(
    tenantId: string,
    vendor: string,
    entityType: string,
    entityId: string,
    externalId: string,
    actor: Actor,
    metadata: Record<string, unknown>,
  ) {
    const [existing] = await this.db
      .select()
      .from(vendorMappings)
      .where(
        and(
          eq(vendorMappings.tenantId, tenantId),
          eq(vendorMappings.vendor, vendor),
          eq(vendorMappings.entityType, entityType),
          eq(vendorMappings.externalId, externalId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(vendorMappings)
        .set({
          entityId,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(vendorMappings.id, existing.id));
      return;
    }

    await this.db.insert(vendorMappings).values({
      tenantId,
      vendor,
      entityType,
      entityId,
      externalId,
      metadata,
      createdBy: actor,
      source: { system: "vendor" },
    });
  }

  private async assignCategories(
    tenantId: string,
    productUuid: string,
    categoryKeys: string[],
    searchText: string,
    styleId: number,
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

    if (overrides.length > 0) {
      await this.db
        .delete(ssProductCategories)
        .where(
          and(
            eq(ssProductCategories.tenantId, tenantId),
            eq(ssProductCategories.productUuid, productUuid),
          ),
        );
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

    // Sellable-first rows often have no category yet — avoid N category queries.
    if (categoryKeys.length === 0) {
      const candidates = fallbackCategorySlugs(searchText);
      if (candidates.length === 0) return;

      // One query for every candidate, then the best-ranked slug that this
      // tenant actually has. Previously this issued a query per matching rule.
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
      const matched =
        candidates.map((slug) => bySlug.get(slug)).find(Boolean) ?? null;
      if (!matched) return;
      await this.db
        .delete(ssProductCategories)
        .where(
          and(
            eq(ssProductCategories.tenantId, tenantId),
            eq(ssProductCategories.productUuid, productUuid),
          ),
        );
      await this.db.insert(ssProductCategories).values({
        tenantId,
        productUuid,
        categoryId: matched,
        assignmentSource: "map",
      });
      return;
    }

    await this.db
      .delete(ssProductCategories)
      .where(
        and(
          eq(ssProductCategories.tenantId, tenantId),
          eq(ssProductCategories.productUuid, productUuid),
        ),
      );

    const mappedIds = new Set<string>();
    for (const key of categoryKeys) {
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
      for (const rule of KEYWORD_FALLBACKS) {
        if (!rule.pattern.test(searchText)) continue;
        const [cat] = await this.db
          .select()
          .from(categories)
          .where(
            and(
              eq(categories.tenantId, tenantId),
              eq(categories.slug, rule.categorySlug),
            ),
          )
          .limit(1);
        if (cat) mappedIds.add(cat.id);
      }
    }

    if (mappedIds.size === 0) {
      for (const key of categoryKeys) {
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
            sampleStyleIds: [styleId],
          });
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

  private async recomputeProductQty(tenantId: string, vendor: string) {
    await this.db.execute(sql`
      update ss_products p
      set qty = coalesce((
        select sum(v.qty)::int from ss_variants v
        where v.product_uuid = p.id and v.tenant_id = p.tenant_id
          and v.vendor = p.vendor and v.active = true
      ), 0),
      updated_at = now()
      where p.tenant_id = ${tenantId} and p.vendor = ${vendor}
    `);
  }
}
