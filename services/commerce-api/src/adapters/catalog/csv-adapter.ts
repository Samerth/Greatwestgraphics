import type { CommerceDatabase } from "../../db/client.js";
import { parseCatalogCsv, parseInventoryCsv } from "./csv-parser.js";
import type {
  VendorCatalogAdapter,
  VendorSyncContext,
  SyncRunResult,
} from "./types.js";
import { CatalogWriter } from "./writer.js";

/**
 * Generic CSV vendor adapter.
 * Use vendorKey "csv" for ad-hoc imports, or any custom slug (e.g. "acme")
 * so future file-drop vendors stay namespaced in the catalog.
 */
export class CsvVendorAdapter implements VendorCatalogAdapter {
  readonly capabilities = {
    fullSync: false,
    inventorySync: true,
    csvImport: true,
  };

  constructor(
    private readonly db: CommerceDatabase,
    readonly vendorKey: string,
    readonly displayName: string = "CSV import",
  ) {}

  async runFullSync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    return this.importCsv(ctx);
  }

  async runInventorySync(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const writer = new CatalogWriter(this.db);
    const run = await writer.beginRun(
      ctx.tenantId,
      this.vendorKey,
      "inventory",
      ctx.actor,
    );

    try {
      const content = ctx.csvInventory ?? ctx.csvContent;
      if (!content?.trim()) {
        throw new Error(
          "CSV inventory content is required (csvInventory or csvContent)",
        );
      }
      const items = parseInventoryCsv(content);
      const { updated, errors } = await writer.updateInventory(
        ctx.tenantId,
        this.vendorKey,
        items,
      );
      const result: SyncRunResult = {
        id: run.id,
        vendor: this.vendorKey,
        type: "inventory",
        status: errors.length ? "completed_with_errors" : "completed",
        stylesProcessed: 0,
        skusUpserted: updated,
        imagesDownloaded: 0,
        errors,
      };
      await writer.finishRun(run.id, result);
      return result;
    } catch (error) {
      await writer.failRun(run.id, error);
      throw error;
    }
  }

  async importCsv(ctx: VendorSyncContext): Promise<SyncRunResult> {
    const writer = new CatalogWriter(this.db);
    const run = await writer.beginRun(
      ctx.tenantId,
      this.vendorKey,
      "csv_import",
      ctx.actor,
    );

    try {
      const content = ctx.csvContent;
      if (!content?.trim()) {
        throw new Error("csvContent is required for CSV import");
      }
      const rows = parseCatalogCsv(content);
      if (rows.length === 0) {
        throw new Error("CSV contained no usable catalog rows (check headers)");
      }
      const { stylesProcessed, skusUpserted, errors } = await writer.upsertSkuRows(
        ctx.tenantId,
        this.vendorKey,
        rows,
        ctx.actor,
      );
      const result: SyncRunResult = {
        id: run.id,
        vendor: this.vendorKey,
        type: "csv_import",
        status: errors.length ? "completed_with_errors" : "completed",
        stylesProcessed,
        skusUpserted,
        imagesDownloaded: 0,
        errors,
      };
      await writer.finishRun(run.id, result);
      return result;
    } catch (error) {
      await writer.failRun(run.id, error);
      throw error;
    }
  }
}
