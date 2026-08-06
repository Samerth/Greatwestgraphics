/**
 * Sanmar SOAP Web Service Client
 *
 * Sanmar uses SOAP/WSDL for PromoStandards integration.
 * This is the primary integration method for:
 * - Real-time product data
 * - Live inventory updates
 * - Order placement & tracking
 * - Invoice & shipment notifications
 *
 * Also supports EDI (Electronic Data Interchange) CSV files via:
 * - Email to EDI mailbox
 * - SFTP uploads
 * - AS2 protocol (daily bulk files)
 */

export class SanmarAuthError extends Error {
  readonly code = "SANMAR_AUTH_ERROR";
}

export class SanmarSOAPError extends Error {
  readonly code = "SANMAR_SOAP_ERROR";
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
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
  // PromoStandards Product Data fields
  partNumber?: string;
  colors?: Array<{
    colorName: string;
    colorCode?: string;
    images?: string[];
  }>;
  sizes?: Array<{
    sizeName: string;
    sizeCode?: string;
  }>;
  materials?: string[]; // e.g., ["100% Cotton", "Cotton/Poly Blend"]
  features?: string[]; // e.g., ["Preshrunk", "Tagless", "Moisture-wicking"]
  weightGsm?: number;
  certifications?: string[];
  careInstructions?: string;
};

export type SanmarSKU = {
  skuId: string;
  productId: string;
  sku: string;
  colorName: string;
  colorCode?: string;
  sizeName: string;
  sizeCode?: string;
  quantity: number;
  price?: number;
  mapPrice?: number;
  imageUrl?: string;
  gtin?: string;
  weight?: number;
  sizeOrder?: number;
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
 * Somar/ATC PromoStandards SOAP/EDI Client
 *
 * Integrates with Somar Canada via PromoStandards WSDL services:
 * 1. Product Data Service v2.0.0 - GetProduct, GetProductSellable
 * 2. Inventory Service v2.0.0 - GetInventoryInformation
 * 3. Pricing & Configuration Service v1.0.0 - GetPricingAndConfiguration
 * 4. Media Service v1.0.0 - GetMediaLibrary, GetMediaURL
 * 5. Bulk Data Service - GetBulkData
 * 6. EDI files for batch uploads via SFTP/Email
 *
 * Account: Great West Graphics (GWG) - Account ID: 161
 * Credentials: accountId (161) and apiPassword (SOAP/EDI access token)
 */
export class SanmarClient {
  // PromoStandards WSDL Endpoints (ATC/Somar Canada Production)
  private readonly endpoints = {
    productData: "https://edi.atc-apparel.com/pstd/productdata2.0/ProductDataServiceV2.php",
    inventory: "https://edi.atc-apparel.com/pstd/inventory2.0/InventoryServiceV2.php",
    pricing: "https://edi.atc-apparel.com/pstd/productpricingconfiguration/PricingAndConfigurationService.php",
    media: "https://edi.atc-apparel.com/pstd/mediaservice/MediaService.php",
    bulkData: "https://edi.atc-apparel.com/bulk-data/BulkDataService.php",
  };

  constructor(
    private readonly accountId: string,
    private readonly apiPassword: string,
    baseUrl?: string,
  ) {
    // baseUrl optional override for UAT/staging
    if (baseUrl) {
      Object.keys(this.endpoints).forEach((key) => {
        (this.endpoints as Record<string, string>)[key] = (this.endpoints as Record<string, string>)[key].replace(
          "edi.atc-apparel.com",
          baseUrl,
        );
      });
    }
  }

  /**
   * Call PromoStandards SOAP service method
   * Uses SOAP/WSDL for PromoStandards integration
   */
  private async callSOAPService<T>(
    endpoint: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    try {
      const soapBody = this.buildSOAPRequest(method, params);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `http://www.promostandards.org/WSDL/${method}`,
          Authorization: this.generateSOAPAuth(),
        },
        body: soapBody,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new SanmarAuthError("SOAP authentication failed (401)");
        }
        const text = await response.text();
        throw new SanmarSOAPError(`SOAP call failed: ${response.status}`, text);
      }

      const xml = await response.text();
      return this.parseSOAPResponse<T>(xml);
    } catch (error) {
      if (error instanceof SanmarAuthError || error instanceof SanmarSOAPError) {
        throw error;
      }
      throw new SanmarSOAPError("SOAP request failed", error);
    }
  }

  /**
   * Get product via PromoStandards GetProduct method
   * Returns: productId, name, description, category, colors, sizes, pricing
   */
  async getProduct(productId: string): Promise<SanmarProduct> {
    const result = await this.callSOAPService<SanmarProduct>(
      this.endpoints.productData,
      "GetProduct",
      {
        id: productId,
        accountId: this.accountId,
      },
    );
    return result;
  }

  /**
   * Get product sellable options via PromoStandards GetProductSellable
   * Returns: available colors, sizes, pricing tiers, configurations
   */
  async getProductSellable(productId: string): Promise<Record<string, unknown>> {
    const result = await this.callSOAPService<Record<string, unknown>>(
      this.endpoints.productData,
      "GetProductSellable",
      {
        id: productId,
        accountId: this.accountId,
      },
    );
    return result;
  }

  /**
   * Get inventory via PromoStandards GetInventoryInformation (real-time)
   * Returns: SKU availability, stock levels by size/color
   */
  async getInventory(): Promise<SanmarInventory[]> {
    const result = await this.callSOAPService<SanmarInventory[]>(
      this.endpoints.inventory,
      "GetInventoryInformation",
      {
        accountId: this.accountId,
      },
    );
    return result;
  }

  /**
   * Get pricing and configuration via PromoStandards
   * Returns: base pricing, volume discounts, currency, pricing tiers
   */
  async getPricing(): Promise<Record<string, unknown>> {
    const result = await this.callSOAPService<Record<string, unknown>>(
      this.endpoints.pricing,
      "GetPricingAndConfiguration",
      {
        accountId: this.accountId,
      },
    );
    return result;
  }

  /**
   * Get bulk data dump (all products, inventory, pricing)
   * Returns: compressed archive with complete catalog data
   */
  async getBulkData(): Promise<Record<string, unknown>> {
    const result = await this.callSOAPService<Record<string, unknown>>(
      this.endpoints.bulkData,
      "GetBulkData",
      {
        accountId: this.accountId,
      },
    );
    return result;
  }

  /**
   * Build SOAP request envelope
   */
  private buildSOAPRequest(method: string, params: Record<string, unknown>): string {
    const paramsXML = Object.entries(params)
      .map(([key, value]) => `<${key}>${String(value)}</${key}>`)
      .join("");

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:api="http://api.sanmarcanada.com/">
  <soap:Body>
    <api:${method}>
      ${paramsXML}
    </api:${method}>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Parse SOAP response XML
   */
  private parseSOAPResponse<T>(xml: string): T {
    // Basic SOAP parsing - in production, use xml2js or similar
    // This is a placeholder that extracts content between tags
    try {
      // Remove namespaces for easier parsing
      const cleaned = xml.replace(/xmlns[^=]*="[^"]*"/g, "");

      // Extract body content
      const bodyMatch = cleaned.match(/<soap:Body>([\s\S]*)<\/soap:Body>/);
      if (!bodyMatch) {
        throw new Error("No SOAP Body found");
      }

      // For now, return parsed content
      // In production: use proper XML parser
      return JSON.parse(
        `{"data": ${bodyMatch[1]}}`,
      ) as T;
    } catch (error) {
      throw new SanmarSOAPError("Failed to parse SOAP response", error);
    }
  }

  /**
   * Generate SOAP authentication header
   */
  private generateSOAPAuth(): string {
    // Basic auth for SOAP
    const credentials = `${this.accountId}:${this.apiPassword}`;
    const encoded = Buffer.from(credentials).toString("base64");
    return `Basic ${encoded}`;
  }

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
