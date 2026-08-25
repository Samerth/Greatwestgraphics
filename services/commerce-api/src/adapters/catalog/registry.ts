import type { Environment } from "../../config.js";
import type { CommerceDatabase } from "../../db/client.js";
import { CsvVendorAdapter } from "./csv-adapter.js";
import type { VendorCatalogAdapter } from "./types.js";
import { BUILTIN_VENDORS } from "./types.js";
import { createSanmarClientFromEnv } from "../sanmar/client.js";
import { SanmarSyncService } from "../sanmar/sync-service.js";
import { SsActivewearClient } from "../ss-activewear/client.js";
import { SsActivewearAdapter } from "../ss-activewear/adapter.js";

export type VendorDescriptor = {
  key: string;
  displayName: string;
  capabilities: VendorCatalogAdapter["capabilities"];
  configured: boolean;
  notes?: string;
};

/**
 * Factory for vendor catalog adapters.
 * Add a new vendor by implementing VendorCatalogAdapter and registering it here.
 */
export class VendorSyncRegistry {
  constructor(
    private readonly db: CommerceDatabase,
    private readonly environment: Environment,
  ) {}

  listVendors(): VendorDescriptor[] {
    const ssConfigured = Boolean(
      this.environment.SS_ACCOUNT_NUMBER && this.environment.SS_API_KEY,
    );
    const sanmarLogin =
      this.environment.SANMAR_LOGIN_EMAIL ||
      this.environment.SANMAR_API_PASSWORD;
    const sanmarConfigured = Boolean(
      this.environment.SANMAR_CSV_DIR ||
        (this.environment.SANMAR_ACCOUNT_ID &&
          sanmarLogin &&
          sanmarLogin.includes("@")),
    );

    return [
      {
        key: BUILTIN_VENDORS.ssActivewear,
        displayName: "S&S Activewear Canada",
        capabilities: {
          fullSync: true,
          inventorySync: true,
          csvImport: false,
        },
        configured: ssConfigured,
        notes: ssConfigured
          ? "Full sync = first import / big updates. Update stock & price = daily qty + CUSTOMER cost."
          : "Set SS_ACCOUNT_NUMBER and SS_API_KEY",
      },
      {
        key: BUILTIN_VENDORS.sanmar,
        displayName: "Sanmar / ATC",
        capabilities: {
          fullSync: true,
          inventorySync: true,
          csvImport: true,
        },
        configured: sanmarConfigured,
        notes: sanmarConfigured
          ? "Full sync = first import / colour photos via Media (capped). Stock & price = Bulk when entitled, else qty/price + Media fallback. SANMAR_MEDIA_PASSWORD does not unlock Bulk."
          : "Set SANMAR_ACCOUNT_ID + SANMAR_LOGIN_EMAIL (login e-mail, not website password). Colour photos also need SANMAR_MEDIA_PASSWORD on the API task.",
      },
      {
        key: BUILTIN_VENDORS.csv,
        displayName: "Generic CSV",
        capabilities: {
          fullSync: false,
          inventorySync: true,
          csvImport: true,
        },
        configured: true,
        notes: "Upload canonical GWG CSV; optional vendorKey namespaces the import",
      },
    ];
  }

  /**
   * Resolve an adapter. For CSV imports, pass customVendorKey to namespace
   * under a future vendor slug (e.g. "acme_blanks").
   */
  getAdapter(
    vendorKey: string,
    options?: { customVendorKey?: string },
  ): VendorCatalogAdapter {
    const key = vendorKey.trim().toLowerCase();

    if (key === BUILTIN_VENDORS.ssActivewear) {
      if (
        !this.environment.SS_ACCOUNT_NUMBER ||
        !this.environment.SS_API_KEY
      ) {
        throw new Error(
          "SS_ACCOUNT_NUMBER and SS_API_KEY must be configured for S&S sync",
        );
      }
      return new SsActivewearAdapter(
        this.db,
        new SsActivewearClient(
          this.environment.SS_ACCOUNT_NUMBER,
          this.environment.SS_API_KEY,
          this.environment.SS_API_BASE_URL,
        ),
      );
    }

    if (key === BUILTIN_VENDORS.sanmar) {
      const client = createSanmarClientFromEnv(this.environment);
      if (!client) {
        throw new Error(
          "Configure SANMAR_CSV_DIR or SANMAR_ACCOUNT_ID + SANMAR_LOGIN_EMAIL (login e-mail per ATC guide)",
        );
      }
      if (!client.validateCredentials() && !this.environment.SANMAR_CSV_DIR) {
        throw new Error(
          "SANMAR_LOGIN_EMAIL must be the SanMar Canada login e-mail address",
        );
      }
      return new SanmarSyncService(this.db, client);
    }

    if (key === BUILTIN_VENDORS.csv) {
      const custom =
        options?.customVendorKey?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") ||
        BUILTIN_VENDORS.csv;
      return new CsvVendorAdapter(
        this.db,
        custom,
        custom === BUILTIN_VENDORS.csv
          ? "Generic CSV"
          : `CSV (${custom})`,
      );
    }

    // Treat unknown keys as CSV-namespaced vendors (future file-drop partners).
    return new CsvVendorAdapter(this.db, key, `CSV (${key})`);
  }
}
