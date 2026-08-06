/**
 * Abstract Vendor Sync Service
 *
 * Base class for all vendor sync implementations (S&S Activewear, Somar, etc.)
 * Provides shared sync logic while allowing vendors to implement their own
 * data fetching strategies.
 */

import { db } from "../db";
import { ssStyles, ssProducts, ssVariants, ssProductCategories, syncRuns } from "../db/schema";
import { eq } from "drizzle-orm";

export interface VendorStyle {
  externalStyleId: string;
  vendor: string;
  brandName?: string;
  styleName: string;
  description?: string;
  category?: string;
  [key: string]: unknown;
}

export interface VendorProduct {
  externalStyleId: string;
  externalProductId: string;
  vendor: string;
  colorName: string;
  colorCode?: string;
  colorImages?: Record<string, string>; // { front, back, left, right, swatch }
  [key: string]: unknown;
}

export interface VendorVariant {
  externalSkuId: string;
  externalProductId: string;
  vendor: string;
  size: string;
  sizeOrder?: number;
  quantity: number;
  price?: number;
  mapPrice?: number;
  [key: string]: unknown;
}

export interface SyncResult {
  status: "success" | "error";
  stylesProcessed: number;
  skusUpserted: number;
  imagesDownloaded: number;
  errorSummary?: string;
  details?: Record<string, unknown>;
}

export abstract class AbstractVendorSyncService {
  protected vendor: string = "unknown";
  protected tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Fetch all styles/products from vendor
   * Implemented by subclasses (S&S API, Somar SOAP, etc.)
   */
  abstract fetchStyles(): Promise<VendorStyle[]>;

  /**
   * Fetch all product variants (color + size combinations)
   */
  abstract fetchVariants(): Promise<VendorVariant[]>;

  /**
   * Fetch current inventory/pricing
   */
  abstract fetchInventory(): Promise<Map<string, { quantity: number; price?: number }>>;

  /**
   * Run full sync: fetch, process, and upsert all data
   */
  async runFullSync(): Promise<SyncResult> {
    const syncRunId = await this.createSyncRun("full", "started");
    let stylesProcessed = 0;
    let skusUpserted = 0;
    let imagesDownloaded = 0;
    const errors: string[] = [];

    try {
      // Fetch data from vendor
      const [styles, variants, inventory] = await Promise.all([
        this.fetchStyles(),
        this.fetchVariants(),
        this.fetchInventory(),
      ]);

      // Process styles
      for (const style of styles) {
        try {
          await this.upsertStyle(style);
          stylesProcessed++;
        } catch (err) {
          errors.push(`Style ${style.externalStyleId}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // Process variants
      for (const variant of variants) {
        try {
          const inv = inventory.get(variant.externalSkuId) || { quantity: 0 };
          await this.upsertVariant(variant, inv.quantity, inv.price);
          skusUpserted++;
        } catch (err) {
          errors.push(`Variant ${variant.externalSkuId}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // Update sync run with results
      await this.updateSyncRun(syncRunId, "success", {
        stylesProcessed,
        skusUpserted,
        imagesDownloaded,
        errorSummary: errors.length > 0 ? errors.slice(0, 10).join("; ") : undefined,
      });

      return {
        status: "success",
        stylesProcessed,
        skusUpserted,
        imagesDownloaded,
        errorSummary: errors.length > 0 ? `${errors.length} errors during sync` : undefined,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await this.updateSyncRun(syncRunId, "error", { errorSummary: errorMsg });
      return {
        status: "error",
        stylesProcessed,
        skusUpserted,
        imagesDownloaded,
        errorSummary: errorMsg,
      };
    }
  }

  /**
   * Run inventory-only sync (faster, just updates qty/pricing)
   */
  async runInventorySync(): Promise<SyncResult> {
    const syncRunId = await this.createSyncRun("inventory", "started");
    let skusUpserted = 0;
    const errors: string[] = [];

    try {
      const inventory = await this.fetchInventory();

      for (const [skuId, data] of inventory) {
        try {
          await this.updateVariantInventory(skuId, data.quantity, data.price);
          skusUpserted++;
        } catch (err) {
          errors.push(`SKU ${skuId}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      await this.updateSyncRun(syncRunId, "success", {
        skusUpserted,
        errorSummary: errors.length > 0 ? errors.slice(0, 10).join("; ") : undefined,
      });

      return {
        status: "success",
        stylesProcessed: 0,
        skusUpserted,
        imagesDownloaded: 0,
        errorSummary: errors.length > 0 ? `${errors.length} errors during sync` : undefined,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await this.updateSyncRun(syncRunId, "error", { errorSummary: errorMsg });
      return {
        status: "error",
        stylesProcessed: 0,
        skusUpserted,
        imagesDownloaded: 0,
        errorSummary: errorMsg,
      };
    }
  }

  /**
   * Upsert style into database
   */
  protected async upsertStyle(style: VendorStyle): Promise<string> {
    const existing = await db
      .select()
      .from(ssStyles)
      .where(eq(ssStyles.styleId, style.externalStyleId))
      .limit(1);

    const styleData = {
      tenantId: this.tenantId,
      styleId: style.externalStyleId,
      vendor: this.vendor,
      brandName: style.brandName,
      styleName: style.styleName,
      description: style.description,
      category: style.category,
    };

    if (existing.length > 0) {
      await db.update(ssStyles).set(styleData).where(eq(ssStyles.id, existing[0].id));
      return existing[0].id;
    } else {
      const [inserted] = await db.insert(ssStyles).values(styleData).returning();
      return inserted.id;
    }
  }

  /**
   * Upsert product variant (color + size combo)
   */
  protected async upsertVariant(
    variant: VendorVariant,
    quantity: number,
    price?: number,
  ): Promise<string> {
    // Get product ID first
    const [product] = await db
      .select()
      .from(ssProducts)
      .where(eq(ssProducts.externalProductId, variant.externalProductId))
      .limit(1);

    if (!product) {
      throw new Error(`Product not found: ${variant.externalProductId}`);
    }

    const variantData = {
      tenantId: this.tenantId,
      productId: product.id,
      skuId: variant.externalSkuId,
      vendor: this.vendor,
      size: variant.size,
      sizeOrder: variant.sizeOrder,
      quantity,
      price: price ? Math.round(price * 100) : undefined, // Convert to cents
    };

    const existing = await db
      .select()
      .from(ssVariants)
      .where(eq(ssVariants.skuId, variant.externalSkuId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(ssVariants).set(variantData).where(eq(ssVariants.id, existing[0].id));
      return existing[0].id;
    } else {
      const [inserted] = await db.insert(ssVariants).values(variantData).returning();
      return inserted.id;
    }
  }

  /**
   * Update variant inventory without full upsert
   */
  protected async updateVariantInventory(skuId: string, quantity: number, price?: number): Promise<void> {
    await db
      .update(ssVariants)
      .set({
        quantity,
        price: price ? Math.round(price * 100) : undefined,
      })
      .where(eq(ssVariants.skuId, skuId));
  }

  /**
   * Create sync run record
   */
  private async createSyncRun(type: string, status: string): Promise<string> {
    const [inserted] = await db
      .insert(syncRuns)
      .values({
        tenantId: this.tenantId,
        type,
        status,
        stylesProcessed: 0,
        skusUpserted: 0,
        imagesDownloaded: 0,
      })
      .returning();
    return inserted.id;
  }

  /**
   * Update sync run with results
   */
  private async updateSyncRun(
    syncRunId: string,
    status: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(syncRuns)
      .set({
        status,
        ...data,
        finishedAt: new Date(),
      })
      .where(eq(syncRuns.id, syncRunId));
  }
}
