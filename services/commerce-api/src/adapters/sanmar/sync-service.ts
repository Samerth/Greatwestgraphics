import { and, eq } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../../db/client.js";
import {
  syncRuns,
  vendorMappings,
} from "../../db/schema.js";
import {
  SanmarClient,
  SanmarAuthError,
  SanmarNotFoundError,
  type SanmarProduct,
  type SanmarSKU,
} from "./client.js";

const VENDOR = "sanmar";

export class SanmarSyncService {
  constructor(
    private readonly db: CommerceDatabase,
    private readonly client: SanmarClient,
  ) {}

  async runFullSync(tenantId: string, actor: Actor) {
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        type: "full",
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api", vendor: VENDOR },
      })
      .returning();

    if (!run) throw new Error("Failed to create sync run");

    let productsProcessed = 0;
    let skusUpserted = 0;
    const errors: string[] = [];

    try {
      const products = await this.client.listProducts();

      for (const product of products) {
        try {
          // Fetch SKUs for each product
          const skus = await this.client.listSKUsByProduct(product.productId);

          // Store vendor mapping
          await this.db
            .insert(vendorMappings)
            .values({
              tenantId,
              vendor: VENDOR,
              entityType: "product",
              entityId: `sanmar-${product.productId}`,
              externalId: product.productId,
              metadata: {
                productName: product.productName,
                brandName: product.brandName,
                category: product.category,
              },
            })
            .onConflictDoUpdate({
              target: [
                vendorMappings.tenantId,
                vendorMappings.vendor,
                vendorMappings.externalId,
              ],
              set: {
                metadata: {
                  productName: product.productName,
                  brandName: product.brandName,
                  category: product.category,
                },
              },
            });

          skusUpserted += skus.length;
          productsProcessed += 1;
        } catch (error) {
          if (error instanceof SanmarNotFoundError) {
            continue;
          }
          errors.push(
            `product ${product.productId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      await this.db
        .update(syncRuns)
        .set({
          status: errors.length ? "completed_with_errors" : "completed",
          stylesProcessed: productsProcessed,
          skusUpserted,
          rateLimitRemaining: this.client.rateLimitRemaining,
          errorSummary: errors.slice(0, 20).join("\n") || null,
          details: { errorCount: errors.length, vendor: VENDOR },
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));

      return {
        id: run.id,
        productsProcessed,
        skusUpserted,
        errors,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
    } catch (error) {
      await this.db
        .update(syncRuns)
        .set({
          status: "failed",
          productsProcessed,
          skusUpserted,
          rateLimitRemaining: this.client.rateLimitRemaining,
          errorSummary:
            error instanceof SanmarAuthError
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

  async runInventorySync(tenantId: string, actor: Actor) {
    const [run] = await this.db
      .insert(syncRuns)
      .values({
        tenantId,
        type: "inventory",
        status: "running",
        createdBy: actor,
        source: { system: "commerce_api", vendor: VENDOR },
      })
      .returning();

    if (!run) throw new Error("Failed to create inventory sync run");

    try {
      const inventory = await this.client.listInventory();
      let updated = 0;

      for (const item of inventory) {
        // Store inventory in vendor_mappings metadata for now
        // In full implementation, would update dedicated inventory table
        await this.db
          .insert(vendorMappings)
          .values({
            tenantId,
            vendor: VENDOR,
            entityType: "inventory",
            entityId: `sanmar-inventory-${item.skuId}`,
            externalId: item.skuId,
            metadata: {
              quantity: item.quantity,
              lastUpdated: item.lastUpdated,
            },
          })
          .onConflictDoUpdate({
            target: [
              vendorMappings.tenantId,
              vendorMappings.vendor,
              vendorMappings.externalId,
            ],
            set: {
              metadata: {
                quantity: item.quantity,
                lastUpdated: item.lastUpdated,
              },
            },
          });

        updated += 1;
      }

      await this.db
        .update(syncRuns)
        .set({
          status: "completed",
          skusUpserted: updated,
          rateLimitRemaining: this.client.rateLimitRemaining,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(syncRuns.id, run.id));

      return {
        id: run.id,
        updated,
        rateLimitRemaining: this.client.rateLimitRemaining,
      };
    } catch (error) {
      await this.db
        .update(syncRuns)
        .set({
          status: "failed",
          errorSummary:
            error instanceof SanmarAuthError
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
}
