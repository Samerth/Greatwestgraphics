import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { CommerceDatabase } from "../../db/client.js";
import { ssProducts, ssStyles } from "../../db/schema.js";
import {
  parseInventoryCsv,
  parseSanmarEdiPair,
  parseCatalogCsv,
} from "../catalog/csv-parser.js";
import type {
  CatalogSkuRow,
  InventoryRow,
  SyncRunResult,
  VendorCatalogAdapter,
  VendorSyncContext,
} from "../catalog/types.js";
import { BUILTIN_VENDORS } from "../catalog/types.js";
import { CatalogWriter } from "../catalog/writer.js";
import {
  SanmarAuthError,
  SanmarBulkLimitError,
  SanmarClient,
  type SanmarProduct,
  type SanmarSKU,
  type SanmarSellablePart,
} from "./client.js";
import {
  applySanmarImagesToCatalogRows,
  assignSanmarColorImages,
  bulkProductsToColorwayPatches,
  buildColorwayMediaPatches,
  pickStyleFallbackImage,
  type ColorImageHint,
} from "./color-images.js";

const VENDOR = BUILTIN_VENDORS.sanmar;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export class SanmarSyncService implements VendorCatalogAdapter {
  readonly vendorKey = VENDOR;
  readonly displayName = "Sanmar / ATC";
  readonly capabilities = {
    fullSync: true,
    inventorySync: true,
    csvImport: true,
  };

  private readonly writer: CatalogWriter;

  constructor(
    private readonly db: CommerceDatabase,
    private readonly client: SanmarClient,
  ) {
    this.writer = new CatalogWriter(db);
  }

  async runFullSync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const run = await this.writer.beginRun(
      ctx.tenantId,
      VENDOR,
      "full",
      ctx.actor,
    );

    try {
      const csvRows = this.resolveCsvCatalogRows(ctx);
      if (csvRows) {
        const { stylesProcessed, skusUpserted, errors } =
          await this.writer.upsertSkuRows(
            ctx.tenantId,
            VENDOR,
            csvRows,
            ctx.actor,
            {
              onProgress: (p) => this.writer.updateRunProgress(run.id, p),
            },
          );
        const result: SyncRunResult = {
          id: run.id,
          vendor: VENDOR,
          type: "full",
          status: errors.length ? "completed_with_errors" : "completed",
          stylesProcessed,
          skusUpserted,
          imagesDownloaded: 0,
          errors,
          rateLimitRemaining: this.client.rateLimitRemaining,
        };
        await this.writer.finishRun(run.id, result);
        return result;
      }

      // Live PromoStandards path:
      // 1) Upsert ALL sellable ACTIVE parts (qty 0 / no price yet)
      // 2) Enrich a capped set of styles via getProduct + optional media
      // 3) Refresh qty + price (Bulk Data preferred, else per-style SOAP)
      const parts = await this.client.listSellableParts();
      const activeParts = parts.filter((part) => !part.discontinued);
      console.log(
        `[sanmar] sellable parts=${parts.length} active=${activeParts.length} uniqueStyles=${
          new Set(activeParts.map((p) => p.styleId)).size
        }`,
      );

      const sellableRows = this.sellableToCatalogRows(activeParts, new Map());
      const { stylesProcessed, skusUpserted, errors } =
        await this.writer.upsertSkuRows(
          ctx.tenantId,
          VENDOR,
          sellableRows,
          ctx.actor,
          {
            fast: true,
            onProgress: async (p) => {
              console.log(
                `[sanmar] upsert progress styles=${p.stylesProcessed} skus=${p.skusUpserted}`,
              );
              await this.writer.updateRunProgress(run.id, p);
            },
          },
        );

      const enrichErrors: string[] = [];
      const enriched = await this.enrichStylesAfterUpsert(
        ctx.tenantId,
        activeParts,
        enrichErrors,
      );
      console.log(`[sanmar] enriched styles=${enriched}`);

      // Only now do the rows carry real product names, so this is the first
      // point at which the keyword rules have anything to read.
      const categorised = await this.writer.assignFallbackCategories(
        ctx.tenantId,
        VENDOR,
      );
      console.log(
        `[sanmar] categorised products=${categorised.assigned} stillUncategorised=${categorised.unmatched}`,
      );

      const stockErrors: string[] = [];
      const { updated: stockUpdated, imagesWritten } =
        await this.refreshQtyAndPrice(
          ctx.tenantId,
          activeParts.map((p) => p.styleId),
          stockErrors,
        );
      console.log(`[sanmar] stock/price rows updated=${stockUpdated}`);

      const allErrors = [...errors, ...enrichErrors, ...stockErrors];
      const result: SyncRunResult = {
        id: run.id,
        vendor: VENDOR,
        type: "full",
        status: allErrors.length ? "completed_with_errors" : "completed",
        stylesProcessed,
        skusUpserted: skusUpserted + stockUpdated,
        imagesDownloaded: imagesWritten,
        errors: allErrors,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
      await this.writer.finishRun(run.id, result);
      return result;
    } catch (error) {
      await this.writer.failRun(run.id, error);
      throw error;
    }
  }

  async runInventorySync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const run = await this.writer.beginRun(
      ctx.tenantId,
      VENDOR,
      "inventory",
      ctx.actor,
    );

    try {
      let items: InventoryRow[];
      const errors: string[] = [];

      if (ctx.csvInventory?.trim()) {
        items = parseInventoryCsv(ctx.csvInventory);
      } else if (ctx.csvContent?.trim() && !ctx.csvSkus) {
        items = parseInventoryCsv(ctx.csvContent);
      } else {
        const styleIds = await this.listCatalogStyleKeys(ctx.tenantId);
        const { updated, imagesWritten } = await this.refreshQtyAndPrice(
          ctx.tenantId,
          styleIds,
          errors,
        );
        let photos = imagesWritten;
        // Bulk photos cover the catalog in one call. When Bulk is unauthorized
        // (or otherwise unavailable), Media can still split colour photos —
        // capped at SANMAR_MAX_PRODUCTS so we do not hammer every style.
        if (imagesWritten === 0 && this.client.hasMediaPassword) {
          photos += await this.enrichMediaForCatalogStyles(
            ctx.tenantId,
            styleIds,
            errors,
          );
        }
        const result: SyncRunResult = {
          id: run.id,
          vendor: VENDOR,
          type: "inventory",
          status: errors.length ? "completed_with_errors" : "completed",
          stylesProcessed: styleIds.length,
          skusUpserted: updated,
          imagesDownloaded: photos,
          errors,
          rateLimitRemaining: this.client.rateLimitRemaining,
        };
        await this.writer.finishRun(run.id, result);
        return result;
      }

      const { updated, errors: writeErrors } = await this.writer.updateInventory(
        ctx.tenantId,
        VENDOR,
        items,
      );

      const result: SyncRunResult = {
        id: run.id,
        vendor: VENDOR,
        type: "inventory",
        status: writeErrors.length ? "completed_with_errors" : "completed",
        stylesProcessed: 0,
        skusUpserted: updated,
        imagesDownloaded: 0,
        errors: writeErrors,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
      await this.writer.finishRun(run.id, result);
      return result;
    } catch (error) {
      await this.writer.failRun(run.id, error);
      throw error;
    }
  }

  async importCsv(ctx: VendorSyncContext): Promise<SyncRunResult> {
    return this.runFullSync(ctx);
  }

  /**
   * Refresh one style via getProduct + getInventoryLevels + pricing + media.
   * Preserves storefront_visible (CatalogWriter never overwrites it).
   */
  async refreshStyle(
    ctx: VendorSyncContext,
    styleKey: string,
  ): Promise<SyncRunResult> {
    const run = await this.writer.beginRun(
      ctx.tenantId,
      VENDOR,
      "full",
      ctx.actor,
    );
    try {
      const { product, skus } = await this.client.getProductWithSkus(styleKey);
      let inventory: Awaited<ReturnType<typeof this.client.getInventoryLevels>> =
        [];
      try {
        inventory = await this.client.getInventoryLevels(styleKey);
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
      }

      let prices = new Map<string, number>();
      try {
        const priced = await this.client.getConfigurationAndPricing(styleKey);
        prices = new Map(priced.map((p) => [p.partId, p.price]));
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
      }

      let mediaUrls: string[] = [];
      if (this.client.hasMediaPassword) {
        try {
          mediaUrls = await this.client.getMediaContent(styleKey);
        } catch (error) {
          if (error instanceof SanmarAuthError) throw error;
        }
      }
      const bag = [...mediaUrls, ...(product.images ?? [])];
      const assigned = assignSanmarColorImages({
        colorNames: [
          ...skus.map((sku) => sku.colorName),
          ...(product.colors ?? []).map((color) => color.colorName),
        ],
        mediaUrls: bag,
        hints: skuImageHints(skus, product),
      });
      const styleFront =
        pickStyleFallbackImage(bag, assigned) || product.images?.[0];

      const qtyBySku = new Map(
        inventory.map((row) => [row.skuId, row.quantity]),
      );
      const rows = applySanmarImagesToCatalogRows(
        this.toCatalogRows([product], skus),
        bag,
        skuImageHints(skus, product),
      ).map((row) => ({
        ...row,
        qty: qtyBySku.get(row.skuKey) ?? row.qty ?? 0,
        priceDollars: prices.get(row.skuKey) ?? row.priceDollars,
      }));
      if (rows.length === 0) {
        await this.writer.patchStyleMetadata(ctx.tenantId, VENDOR, [
          {
            styleKey: product.productId,
            brandName: product.brandName || "SanMar Canada",
            styleName: product.productName,
            title: product.productName,
            description: product.description,
            category: product.category,
            imageFront: styleFront,
          },
        ]);
        await this.writer.patchColorwayMedia(
          ctx.tenantId,
          VENDOR,
          buildColorwayMediaPatches({
            styleKey: product.productId,
            colorNames: (product.colors ?? []).map((color) => color.colorName),
            mediaUrls: bag,
            hints: skuImageHints(skus, product),
          }),
        );
      }
      const { stylesProcessed, skusUpserted, errors } =
        rows.length > 0
          ? await this.writer.upsertSkuRows(
              ctx.tenantId,
              VENDOR,
              rows,
              ctx.actor,
              { fast: false },
            )
          : { stylesProcessed: 1, skusUpserted: 0, errors: [] as string[] };

      const result: SyncRunResult = {
        id: run.id,
        vendor: VENDOR,
        type: "full",
        status: errors.length ? "completed_with_errors" : "completed",
        stylesProcessed,
        skusUpserted,
        imagesDownloaded: mediaUrls.length,
        errors,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
      await this.writer.finishRun(run.id, result);
      return result;
    } catch (error) {
      await this.writer.failRun(run.id, error);
      throw error;
    }
  }

  private resolveCsvCatalogRows(
    ctx: VendorSyncContext,
  ): CatalogSkuRow[] | null {
    if (ctx.csvProducts?.trim() && ctx.csvSkus?.trim()) {
      return parseSanmarEdiPair(ctx.csvProducts, ctx.csvSkus);
    }
    if (ctx.csvContent?.trim()) {
      return parseCatalogCsv(ctx.csvContent);
    }
    return null;
  }

  /**
   * Prefer Bulk Data (1 call/day, qty+price for all parts). Fall back to
   * concurrent per-style inventory + pricing SOAP over catalog style keys.
   * Bulk "not authorized" is an entitlement miss — do not treat it as a
   * login failure, and do not send SANMAR_MEDIA_PASSWORD to Bulk.
   */
  private async refreshQtyAndPrice(
    tenantId: string,
    preferredStyleIds: string[],
    errors: string[],
  ): Promise<{ updated: number; imagesWritten: number }> {
    // 1) Bulk Data path
    try {
      const bulk = await this.client.getBulkProducts();
      console.log(`[sanmar] bulk products=${bulk.length}`);
      const items: InventoryRow[] = bulk.map((row) => ({
        skuKey: row.partId,
        qty: row.quantity,
        priceDollars: row.price,
      }));
      const { updated, errors: writeErrors } = await this.writer.updateInventory(
        tenantId,
        VENDOR,
        items,
      );
      errors.push(...writeErrors);
      const imagePatches = bulkProductsToColorwayPatches(bulk);
      const imagesWritten = await this.writer.patchColorwayMedia(
        tenantId,
        VENDOR,
        imagePatches,
      );
      console.log(
        `[sanmar] bulk colour photos written=${imagesWritten}/${imagePatches.length}`,
      );
      return { updated, imagesWritten };
    } catch (error) {
      if (error instanceof SanmarAuthError) throw error;
      const message =
        error instanceof SanmarBulkLimitError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.log(`[sanmar] bulk unavailable, falling back to per-style: ${message}`);
      errors.push(`bulk: ${message}`);
    }

    // 2) Per-style inventory + pricing
    const fromDb = await this.listCatalogStyleKeys(tenantId);
    const styleIds = [
      ...new Set(
        [...preferredStyleIds, ...fromDb].map((s) => s.trim()).filter(Boolean),
      ),
    ];
    const maxRaw = process.env.SANMAR_INVENTORY_MAX?.trim();
    const max = maxRaw ? Number.parseInt(maxRaw, 10) : 0;
    const limited = max > 0 ? styleIds.slice(0, max) : styleIds;
    const concurrency = Number(process.env.SANMAR_ENRICH_CONCURRENCY || "4");

    console.log(
      `[sanmar] per-style stock/price styles=${limited.length}/${styleIds.length} concurrency=${concurrency}`,
    );

    const items: InventoryRow[] = [];
    await mapPool(limited, concurrency, async (styleId) => {
      try {
        const [inventory, prices] = await Promise.all([
          this.client.getInventoryLevels(styleId).catch((error) => {
            if (error instanceof SanmarAuthError) throw error;
            errors.push(
              `inventory ${styleId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return [] as Awaited<
              ReturnType<typeof this.client.getInventoryLevels>
            >;
          }),
          this.client.getConfigurationAndPricing(styleId).catch((error) => {
            if (error instanceof SanmarAuthError) throw error;
            errors.push(
              `pricing ${styleId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return [] as Awaited<
              ReturnType<typeof this.client.getConfigurationAndPricing>
            >;
          }),
        ]);

        const priceByPart = new Map(prices.map((p) => [p.partId, p.price]));

        for (const row of inventory) {
          items.push({
            skuKey: row.skuId,
            qty: row.quantity,
            priceDollars: priceByPart.get(row.skuId) ?? row.price,
          });
        }
        // Do not invent qty:0 rows for pricing-only parts — updateInventory
        // always writes qty and would wipe unknown stock.
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
        errors.push(
          `stock ${styleId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    if (items.length === 0) return { updated: 0, imagesWritten: 0 };
    const { updated, errors: writeErrors } = await this.writer.updateInventory(
      tenantId,
      VENDOR,
      items,
    );
    errors.push(...writeErrors);
    return { updated, imagesWritten: 0 };
  }

  private async listCatalogStyleKeys(tenantId: string): Promise<string[]> {
    const rows = await this.db
      .select({ externalKey: ssStyles.externalKey })
      .from(ssStyles)
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, VENDOR),
          isNotNull(ssStyles.externalKey),
        ),
      );
    return rows
      .map((r) => r.externalKey)
      .filter((k): k is string => Boolean(k));
  }

  /** Styles that still have at least one storefront-visible colourway. */
  private async listStorefrontStyleKeys(tenantId: string): Promise<string[]> {
    const rows = await this.db
      .select({ externalKey: ssStyles.externalKey })
      .from(ssStyles)
      .innerJoin(ssProducts, eq(ssProducts.styleUuid, ssStyles.id))
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, VENDOR),
          eq(ssProducts.storefrontVisible, true),
          isNotNull(ssStyles.externalKey),
        ),
      );
    return [
      ...new Set(
        rows
          .map((row) => row.externalKey)
          .filter((key): key is string => Boolean(key)),
      ),
    ];
  }

  private async listStyleColorNames(
    tenantId: string,
    styleKeys: string[],
  ): Promise<Map<string, string[]>> {
    const byStyle = new Map<string, string[]>();
    if (styleKeys.length === 0) return byStyle;
    const rows = await this.db
      .select({
        externalKey: ssStyles.externalKey,
        colorName: ssProducts.colorName,
      })
      .from(ssStyles)
      .innerJoin(ssProducts, eq(ssProducts.styleUuid, ssStyles.id))
      .where(
        and(
          eq(ssStyles.tenantId, tenantId),
          eq(ssStyles.vendor, VENDOR),
          inArray(ssStyles.externalKey, styleKeys),
        ),
      );
    for (const row of rows) {
      if (!row.externalKey) continue;
      const list = byStyle.get(row.externalKey) ?? [];
      list.push(row.colorName);
      byStyle.set(row.externalKey, list);
    }
    return byStyle;
  }

  /**
   * When Bulk cannot supply part photos, call getMediaContent for a capped
   * set of storefront styles. Default cap is SANMAR_MAX_PRODUCTS (50) so a
   * 400+ style catalog is not crawled in one inventory run.
   */
  private async enrichMediaForCatalogStyles(
    tenantId: string,
    preferredStyleIds: string[],
    errors: string[],
  ): Promise<number> {
    if (!this.client.hasMediaPassword) return 0;
    const enrichLimit = Number(process.env.SANMAR_MAX_PRODUCTS || "50");
    const storefront = await this.listStorefrontStyleKeys(tenantId);
    const ordered = [
      ...new Set(
        [...storefront, ...preferredStyleIds]
          .map((styleId) => styleId.trim())
          .filter(Boolean),
      ),
    ];
    const toEnrich = ordered.slice(0, Math.max(0, enrichLimit));
    if (toEnrich.length === 0) return 0;

    const concurrency = Number(process.env.SANMAR_ENRICH_CONCURRENCY || "4");
    console.log(
      `[sanmar] media fallback styles=${toEnrich.length}/${ordered.length} (cap=${enrichLimit}, concurrency=${concurrency})`,
    );

    const colorsByStyle = await this.listStyleColorNames(tenantId, toEnrich);
    const colorPatches: ReturnType<typeof buildColorwayMediaPatches> = [];

    await mapPool(toEnrich, concurrency, async (styleId) => {
      try {
        const urls = await this.client.getMediaContent(styleId);
        if (!urls.length) return;
        colorPatches.push(
          ...buildColorwayMediaPatches({
            styleKey: styleId,
            colorNames: colorsByStyle.get(styleId) ?? [],
            mediaUrls: urls,
          }),
        );
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
        errors.push(
          `media ${styleId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    const colourPhotos = await this.writer.patchColorwayMedia(
      tenantId,
      VENDOR,
      colorPatches,
    );
    console.log(
      `[sanmar] media fallback colour photos written=${colourPhotos}/${colorPatches.length}`,
    );
    return colourPhotos;
  }

  /**
   * Enrich style names/brands/images via getProduct (+ optional media) AFTER
   * sellable upsert. SANMAR_MAX_PRODUCTS caps enrichment only.
   */
  private async enrichStylesAfterUpsert(
    tenantId: string,
    activeParts: SanmarSellablePart[],
    errors: string[],
  ): Promise<number> {
    const styleIds = [...new Set(activeParts.map((part) => part.styleId))];
    const enrichLimit = Number(process.env.SANMAR_MAX_PRODUCTS || "50");
    const concurrency = Number(process.env.SANMAR_ENRICH_CONCURRENCY || "4");
    const toEnrich = styleIds.slice(0, Math.max(0, enrichLimit));
    if (toEnrich.length === 0) return 0;

    console.log(
      `[sanmar] enriching ${toEnrich.length}/${styleIds.length} styles (concurrency=${concurrency}, media=${this.client.hasMediaPassword})`,
    );

    const products = new Map<
      string,
      { product: SanmarProduct; skus: SanmarSKU[] }
    >();
    const mediaByStyle = new Map<string, string[]>();

    await mapPool(toEnrich, concurrency, async (styleId) => {
      try {
        products.set(styleId, await this.client.getProductWithSkus(styleId));
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
        errors.push(
          `enrich ${styleId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      if (!this.client.hasMediaPassword) return;
      try {
        const urls = await this.client.getMediaContent(styleId);
        if (urls.length) mediaByStyle.set(styleId, urls);
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
        errors.push(
          `media ${styleId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    const colorsByStyle = new Map<string, string[]>();
    for (const part of activeParts) {
      const list = colorsByStyle.get(part.styleId) ?? [];
      list.push(part.colorName);
      colorsByStyle.set(part.styleId, list);
    }

    const stylePatches: Array<{
      styleKey: string;
      brandName?: string | null;
      styleName?: string | null;
      title?: string | null;
      description?: string | null;
      category?: string | null;
      imageFront?: string | null;
    }> = [];
    const colorPatches: ReturnType<typeof buildColorwayMediaPatches> = [];

    for (const [styleId, { product, skus }] of products) {
      const mediaUrls = mediaByStyle.get(styleId) ?? [];
      const bag = [...mediaUrls, ...(product.images ?? [])];
      const colorNames = [
        ...(colorsByStyle.get(styleId) ?? []),
        ...skus.map((sku) => sku.colorName),
        ...(product.colors ?? []).map((color) => color.colorName),
      ];
      const hints = skuImageHints(skus, product);
      const assigned = assignSanmarColorImages({
        colorNames,
        mediaUrls: bag,
        hints,
      });
      stylePatches.push({
        styleKey: product.productId,
        brandName: product.brandName || "SanMar Canada",
        styleName: product.productName,
        title: product.productName,
        description: product.description,
        category: product.category,
        imageFront:
          pickStyleFallbackImage(bag, assigned) || product.images?.[0],
      });
      colorPatches.push(
        ...buildColorwayMediaPatches({
          styleKey: product.productId,
          colorNames,
          mediaUrls: bag,
          hints,
        }),
      );
    }

    const updated = await this.writer.patchStyleMetadata(
      tenantId,
      VENDOR,
      stylePatches,
    );
    const colourPhotos = await this.writer.patchColorwayMedia(
      tenantId,
      VENDOR,
      colorPatches,
    );
    console.log(
      `[sanmar] enrich colour photos written=${colourPhotos}/${colorPatches.length}`,
    );
    return updated;
  }

  private sellableToCatalogRows(
    parts: SanmarSellablePart[],
    products: Map<string, SanmarProduct>,
  ): CatalogSkuRow[] {
    const byStyle = new Map<string, SanmarSellablePart[]>();
    for (const part of parts) {
      const list = byStyle.get(part.styleId) ?? [];
      list.push(part);
      byStyle.set(part.styleId, list);
    }

    const rows: CatalogSkuRow[] = [];
    for (const [styleId, styleParts] of byStyle) {
      const product = products.get(styleId);
      rows.push(
        ...applySanmarImagesToCatalogRows(
          styleParts.map((part) => ({
            styleKey: part.styleId,
            brandName: product?.brandName || "SanMar Canada",
            styleName: product?.productName || part.styleId,
            title: product?.productName,
            description: product?.description,
            category: product?.category,
            colorName: part.colorName,
            sizeName: part.sizeName,
            skuKey: part.partId,
            sku: part.partId,
            qty: 0,
          })),
          product?.images,
          (product?.colors ?? []).map((color) => ({
            colorName: color.colorName,
            hex: color.hex,
          })),
        ),
      );
    }
    return rows;
  }

  /** Kept for CSV/SOAP SKU list paths. */
  private toCatalogRows(
    products: SanmarProduct[],
    skus: SanmarSKU[],
  ): CatalogSkuRow[] {
    const byId = new Map(products.map((p) => [p.productId, p]));
    return applySanmarImagesToCatalogRows(
      skus.map((sku) => {
        const product = byId.get(sku.productId);
        return {
          styleKey: sku.productId,
          brandName: product?.brandName || "SanMar Canada",
          styleName: product?.productName || sku.productId,
          title: product?.productName,
          description: product?.description,
          category: product?.category,
          colorName: sku.colorName,
          colorCode: sku.colorCode,
          colorHex: sku.colorHex,
          sizeName: sku.sizeName,
          sizeCode: sku.sizeCode,
          sizeOrder: sku.sizeOrder,
          skuKey: sku.skuId,
          sku: sku.sku,
          gtin: sku.gtin,
          qty: sku.quantity,
          priceDollars: sku.price ?? product?.basePrice,
          mapPriceDollars: sku.mapPrice,
          imageFront: sku.imageUrl,
        };
      }),
      products.flatMap((product) => product.images ?? []),
      products.flatMap((product) => skuImageHints([], product)),
    );
  }
}

function skuImageHints(
  skus: SanmarSKU[],
  product?: SanmarProduct,
): ColorImageHint[] {
  return [
    ...skus.map((sku) => ({
      colorName: sku.colorName,
      url: sku.imageUrl,
      hex: sku.colorHex,
    })),
    ...(product?.colors ?? []).map((color) => ({
      colorName: color.colorName,
      hex: color.hex,
    })),
  ];
}
