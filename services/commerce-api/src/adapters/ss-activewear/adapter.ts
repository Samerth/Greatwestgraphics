import type { CommerceDatabase } from "../../db/client.js";
import type {
  SyncRunResult,
  VendorCatalogAdapter,
  VendorSyncContext,
} from "../catalog/types.js";
import { BUILTIN_VENDORS } from "../catalog/types.js";
import type { SsActivewearClient } from "./client.js";
import { SsSyncService } from "./sync-service.js";

/**
 * Thin adapter wrapping the existing S&S sync implementation so it
 * participates in the multi-vendor registry.
 */
export class SsActivewearAdapter implements VendorCatalogAdapter {
  readonly vendorKey = BUILTIN_VENDORS.ssActivewear;
  readonly displayName = "S&S Activewear Canada";
  readonly capabilities = {
    fullSync: true,
    inventorySync: true,
    csvImport: false,
  };

  private readonly sync: SsSyncService;

  constructor(db: CommerceDatabase, client: SsActivewearClient) {
    this.sync = new SsSyncService(db, client);
  }

  async runFullSync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const result = await this.sync.runFullSync(ctx.tenantId, ctx.actor);
    return {
      id: result.id,
      vendor: this.vendorKey,
      type: "full",
      status: "completed",
      stylesProcessed: result.stylesProcessed ?? 0,
      skusUpserted: result.skusUpserted ?? 0,
      imagesDownloaded: result.imagesDownloaded ?? 0,
      errors: result.errors ?? [],
      rateLimitRemaining: result.rateLimitRemaining,
    };
  }

  async runInventorySync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const result = await this.sync.runInventorySync(ctx.tenantId, ctx.actor);
    return {
      id: result.id,
      vendor: this.vendorKey,
      type: "inventory",
      status: "completed",
      stylesProcessed: 0,
      skusUpserted: result.updated ?? 0,
      imagesDownloaded: 0,
      errors: [],
      rateLimitRemaining:
        "rateLimitRemaining" in result
          ? (result as { rateLimitRemaining?: number | null }).rateLimitRemaining
          : null,
    };
  }

  async refreshStyle(
    ctx: VendorSyncContext,
    styleKey: string,
  ): Promise<SyncRunResult> {
    const result = await this.sync.refreshStyle(
      ctx.tenantId,
      styleKey,
      ctx.actor,
    );
    return {
      id: result.id,
      vendor: this.vendorKey,
      type: "full",
      status: "completed",
      stylesProcessed: result.stylesProcessed ?? 1,
      skusUpserted: result.skusUpserted ?? 0,
      imagesDownloaded: result.imagesDownloaded ?? 0,
      errors: result.errors ?? [],
      rateLimitRemaining: result.rateLimitRemaining,
    };
  }
}
