/**
 * @deprecated Import from `./catalog/types.js` and `./catalog/registry.js`.
 * Kept as a thin re-export so older imports keep typechecking.
 */
export type {
  CatalogSkuRow,
  InventoryRow,
  SyncRunResult,
  VendorCatalogAdapter,
  VendorSyncCapabilities,
  VendorSyncContext,
} from "./catalog/types.js";
export { BUILTIN_VENDORS } from "./catalog/types.js";
export { VendorSyncRegistry } from "./catalog/registry.js";
export { CatalogWriter } from "./catalog/writer.js";
