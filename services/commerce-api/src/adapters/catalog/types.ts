import type { Actor } from "@gwg/contracts";

/** Built-in vendor keys. Custom CSV vendors use any slug (e.g. "acme_blank"). */
export const BUILTIN_VENDORS = {
  ssActivewear: "ss_activewear",
  sanmar: "sanmar",
  csv: "csv",
} as const;

export type BuiltinVendorKey =
  (typeof BUILTIN_VENDORS)[keyof typeof BUILTIN_VENDORS];

/**
 * Canonical row every vendor adapter must produce before writing to catalog.
 * One row = one size SKU under a style+color.
 */
export type CatalogSkuRow = {
  styleKey: string;
  brandName: string;
  styleName: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  colorName: string;
  colorCode?: string | null;
  colorHex?: string | null;
  sizeName: string;
  sizeCode?: string | null;
  sizeOrder?: number;
  /** Opaque vendor SKU id (Sanmar skuId, S&S skuID_Master, CSV sku_key). */
  skuKey: string;
  sku: string;
  gtin?: string | null;
  qty: number;
  priceDollars?: number | null;
  mapPriceDollars?: number | null;
  imageFront?: string | null;
  imageSide?: string | null;
  imageBack?: string | null;
  imageSwatch?: string | null;
};

export type InventoryRow = {
  skuKey?: string;
  sku?: string;
  qty: number;
  priceDollars?: number | null;
};

export type SyncRunResult = {
  id: string;
  vendor: string;
  type: "full" | "inventory" | "csv_import";
  status: string;
  stylesProcessed: number;
  skusUpserted: number;
  imagesDownloaded: number;
  errors: string[];
  rateLimitRemaining?: number | null;
};

export type VendorSyncCapabilities = {
  fullSync: boolean;
  inventorySync: boolean;
  csvImport: boolean;
};

export type VendorSyncContext = {
  tenantId: string;
  actor: Actor;
  /** Optional CSV payload for adapters that accept file import. */
  csvContent?: string;
  /** For multi-file Sanmar EDI: products + skus. */
  csvProducts?: string;
  csvSkus?: string;
  csvInventory?: string;
};

export interface VendorCatalogAdapter {
  readonly vendorKey: string;
  readonly displayName: string;
  readonly capabilities: VendorSyncCapabilities;
  runFullSync(ctx: VendorSyncContext): Promise<SyncRunResult>;
  runInventorySync(ctx: VendorSyncContext): Promise<SyncRunResult>;
  importCsv?(ctx: VendorSyncContext): Promise<SyncRunResult>;
  /** Refresh one style (metadata + inventory). Optional — Phase 1: Sanmar + S&S. */
  refreshStyle?(
    ctx: VendorSyncContext,
    styleKey: string,
  ): Promise<SyncRunResult>;
}
