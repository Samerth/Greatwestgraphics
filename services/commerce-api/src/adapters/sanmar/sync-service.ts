import type { CommerceDatabase } from "../../db/client.js";
import {
  parseInventoryCsv,
  parseSanmarEdiPair,
  parseCatalogCsv,
} from "../catalog/csv-parser.js";
import type {
  CatalogSkuRow,
  SyncRunResult,
  VendorCatalogAdapter,
  VendorSyncContext,
} from "../catalog/types.js";
import { BUILTIN_VENDORS } from "../catalog/types.js";
import { CatalogWriter } from "../catalog/writer.js";
import {
  SanmarAuthError,
  SanmarClient,
  type SanmarProduct,
  type SanmarSKU,
  type SanmarSellablePart,
} from "./client.js";

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
      // 1) Upsert ALL sellable ACTIVE parts immediately (styleId as name fallback)
      // 2) Optionally enrich a capped set of styles via getProduct afterward
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

      const allErrors = [...errors, ...enrichErrors];
      const result: SyncRunResult = {
        id: run.id,
        vendor: VENDOR,
        type: "full",
        status: allErrors.length ? "completed_with_errors" : "completed",
        stylesProcessed,
        skusUpserted,
        imagesDownloaded: 0,
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
      let items;
      if (ctx.csvInventory?.trim()) {
        items = parseInventoryCsv(ctx.csvInventory);
      } else if (ctx.csvContent?.trim() && !ctx.csvSkus) {
        items = parseInventoryCsv(ctx.csvContent);
      } else {
        const inventory = await this.client.listInventory();
        items = inventory.map((row) => ({
          skuKey: row.skuId,
          qty: row.quantity,
          priceDollars: row.price,
        }));
      }

      const { updated, errors } = await this.writer.updateInventory(
        ctx.tenantId,
        VENDOR,
        items,
      );

      const result: SyncRunResult = {
        id: run.id,
        vendor: VENDOR,
        type: "inventory",
        status: errors.length ? "completed_with_errors" : "completed",
        stylesProcessed: 0,
        skusUpserted: updated,
        imagesDownloaded: 0,
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

  async importCsv(ctx: VendorSyncContext): Promise<SyncRunResult> {
    return this.runFullSync(ctx);
  }

  /**
   * Refresh one style via getProduct + getInventoryLevels.
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
        // Inventory optional — still upsert product metadata/SKUs.
      }
      const qtyBySku = new Map(
        inventory.map((row) => [row.skuId, row.quantity]),
      );
      const rows = this.toCatalogRows([product], skus).map((row) => ({
        ...row,
        qty: qtyBySku.get(row.skuKey) ?? row.qty ?? 0,
      }));
      if (rows.length === 0) {
        // getProduct returned no parts — still patch style metadata.
        await this.writer.patchStyleMetadata(ctx.tenantId, VENDOR, [
          {
            styleKey: product.productId,
            brandName: product.brandName || "SanMar Canada",
            styleName: product.productName,
            title: product.productName,
            description: product.description,
            category: product.category,
            imageFront: product.images?.[0],
          },
        ]);
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
        imagesDownloaded: 0,
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
   * Enrich style names/brands/images via getProduct AFTER sellable upsert.
   * SANMAR_MAX_PRODUCTS caps enrichment only — never the sellable import.
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
      `[sanmar] enriching ${toEnrich.length}/${styleIds.length} styles (concurrency=${concurrency})`,
    );

    const products = new Map<string, SanmarProduct>();
    await mapPool(toEnrich, concurrency, async (styleId) => {
      try {
        products.set(styleId, await this.client.getProduct(styleId));
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
        errors.push(
          `enrich ${styleId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    const patches = [...products.values()].map((product) => ({
      styleKey: product.productId,
      brandName: product.brandName || "SanMar Canada",
      styleName: product.productName,
      title: product.productName,
      description: product.description,
      category: product.category,
      imageFront: product.images?.[0],
    }));

    return this.writer.patchStyleMetadata(tenantId, VENDOR, patches);
  }

  private sellableToCatalogRows(
    parts: SanmarSellablePart[],
    products: Map<string, SanmarProduct>,
  ): CatalogSkuRow[] {
    return parts.map((part) => {
      const product = products.get(part.styleId);
      return {
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
        imageFront: product?.images?.[0],
      };
    });
  }

  /** Kept for CSV/SOAP SKU list paths. */
  private toCatalogRows(
    products: SanmarProduct[],
    skus: SanmarSKU[],
  ): CatalogSkuRow[] {
    const byId = new Map(products.map((p) => [p.productId, p]));
    return skus.map((sku) => {
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
        sizeName: sku.sizeName,
        sizeCode: sku.sizeCode,
        sizeOrder: sku.sizeOrder,
        skuKey: sku.skuId,
        sku: sku.sku,
        gtin: sku.gtin,
        qty: sku.quantity,
        priceDollars: sku.price ?? product?.basePrice,
        mapPriceDollars: sku.mapPrice,
        imageFront: sku.imageUrl ?? product?.images?.[0],
      };
    });
  }
}
