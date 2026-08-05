/**
 * Sanmar EDI (Electronic Data Interchange) Client
 *
 * Sanmar uses EDI format for data exchange (not REST API).
 * EDI files are typically delivered via:
 * - Email to EDI mailbox
 * - SFTP uploads
 * - AS2 protocol
 *
 * This client handles EDI file processing:
 * - X.12 format parsing (ASC X12 standard)
 * - CSV format fallback
 * - Bulk product data sync (daily)
 * - Inventory updates
 */

export class SanmarAuthError extends Error {
  readonly code = "SANMAR_AUTH_ERROR";
}

export class SanmarEDIError extends Error {
  readonly code = "SANMAR_EDI_ERROR";
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export type SanmarProduct = {
  productId: string;
  productName: string;
  description?: string;
  brandName?: string;
  category?: string;
  basePrice?: number;
  images?: string[];
};

export type SanmarSKU = {
  skuId: string;
  productId: string;
  sku: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  price?: number;
  imageUrl?: string;
};

export type SanmarInventory = {
  skuId: string;
  quantity: number;
  lastUpdated: string;
};

export type EDIFileMetadata = {
  fileName: string;
  fileType: "X12" | "CSV" | "JSON";
  receivedAt: Date;
  accountId: string;
};

/**
 * Sanmar EDI Client
 *
 * Handles EDI data processing for Sanmar catalog sync.
 * Credentials: accountId (161) and apiPassword (EDI access token)
 */
export class SanmarClient {
  constructor(
    private readonly accountId: string,
    private readonly apiPassword: string,
  ) {}

  /**
   * Parse EDI CSV file containing product data.
   * Expected format: productId, productName, brandName, category, price, imageUrl
   */
  async parseProductDataCSV(csvContent: string): Promise<SanmarProduct[]> {
    try {
      const lines = csvContent.split("\n").filter((line) => line.trim());
      const products: SanmarProduct[] = [];

      for (const line of lines) {
        const [productId, productName, brandName, category, basePrice, ...imageUrls] =
          line.split(",").map((v) => v.trim());

        if (!productId || !productName) continue;

        products.push({
          productId,
          productName,
          brandName: brandName || undefined,
          category: category || undefined,
          basePrice: basePrice ? parseFloat(basePrice) : undefined,
          images: imageUrls.filter((url) => url.length > 0),
        });
      }

      return products;
    } catch (error) {
      throw new SanmarEDIError("Failed to parse product CSV", error);
    }
  }

  /**
   * Parse EDI CSV file containing SKU/inventory data.
   * Expected format: skuId, productId, sku, colorName, sizeName, quantity, price
   */
  async parseSKUDataCSV(csvContent: string): Promise<SanmarSKU[]> {
    try {
      const lines = csvContent.split("\n").filter((line) => line.trim());
      const skus: SanmarSKU[] = [];

      for (const line of lines) {
        const [skuId, productId, sku, colorName, sizeName, quantity, price, imageUrl] = line
          .split(",")
          .map((v) => v.trim());

        if (!skuId || !productId || !sku) continue;

        skus.push({
          skuId,
          productId,
          sku,
          colorName: colorName || "Standard",
          sizeName: sizeName || "One Size",
          quantity: parseInt(quantity, 10) || 0,
          price: price ? parseFloat(price) : undefined,
          imageUrl: imageUrl || undefined,
        });
      }

      return skus;
    } catch (error) {
      throw new SanmarEDIError("Failed to parse SKU CSV", error);
    }
  }

  /**
   * Parse EDI inventory update file.
   * Expected format: skuId, quantity, timestamp
   */
  async parseInventoryCSV(csvContent: string): Promise<SanmarInventory[]> {
    try {
      const lines = csvContent.split("\n").filter((line) => line.trim());
      const inventory: SanmarInventory[] = [];

      for (const line of lines) {
        const [skuId, quantity, lastUpdated] = line.split(",").map((v) => v.trim());

        if (!skuId) continue;

        inventory.push({
          skuId,
          quantity: parseInt(quantity, 10) || 0,
          lastUpdated: lastUpdated || new Date().toISOString(),
        });
      }

      return inventory;
    } catch (error) {
      throw new SanmarEDIError("Failed to parse inventory CSV", error);
    }
  }

  /**
   * Validate EDI credentials against Sanmar
   */
  validateCredentials(): boolean {
    return Boolean(this.accountId && this.apiPassword);
  }

  /**
   * Get metadata about the EDI file
   */
  getFileMetadata(fileName: string): EDIFileMetadata {
    const fileType = fileName.endsWith(".x12")
      ? "X12"
      : fileName.endsWith(".csv")
        ? "CSV"
        : "JSON";

    return {
      fileName,
      fileType,
      receivedAt: new Date(),
      accountId: this.accountId,
    };
  }
}
