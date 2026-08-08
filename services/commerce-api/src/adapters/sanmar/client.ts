/**
 * SanMar Canada / ATC PromoStandards client
 * (ATC_Pstd_IntegrationGuide_2025).
 *
 * Auth (Product Data + Inventory):
 *   id       = SanMar Canada customer ID
 *   password = SanMar Canada login e-mail address  ← NOT the website password
 *
 * getProductSellable.productId must be a style #, ACTIVE, or ALL.
 * Sellable productId values look like: NF0A529K(TNF Black,S,)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

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

export class SanmarNotFoundError extends Error {
  readonly code = "SANMAR_NOT_FOUND";
}

export type SanmarProduct = {
  productId: string;
  productName: string;
  description?: string;
  brandName?: string;
  category?: string;
  basePrice?: number;
  images?: string[];
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
  sizeOrder?: number;
  discontinued?: boolean;
};

export type SanmarInventory = {
  skuId: string;
  quantity: number;
  lastUpdated: string;
  price?: number;
};

export type SanmarSellablePart = {
  styleId: string;
  colorName: string;
  sizeName: string;
  partId: string;
  discontinued: boolean;
  rawProductId: string;
};

export type SanmarClientOptions = {
  accountId: string;
  /** SanMar Canada login e-mail (PromoStandards "password" field). */
  loginEmail: string;
  baseUrl?: string;
  /** Cap unique styles hydrated via getProduct after sellable discovery. */
  maxProducts?: number;
  /** Explicit style IDs (skips ACTIVE sellable discovery). */
  productIds?: string[];
  /** Directory containing products.csv / skus.csv / inventory.csv. */
  csvDir?: string;
  /** ACTIVE (default) or ALL for getProductSellable. */
  sellableMode?: "ACTIVE" | "ALL";
};

const NS_PD =
  "http://www.promostandards.org/WSDL/ProductDataService/2.0.0/";
const NS_INV = "http://www.promostandards.org/WSDL/Inventory/2.0.0/";

function splitCsvLine(line: string): string[] {
  return line.split(",").map((v) => v.trim());
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractTags(xml: string, localName: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>`,
    "gi",
  );
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const raw = (match[1] ?? "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (raw) values.push(raw);
  }
  return values;
}

function firstTag(xml: string, localName: string): string | undefined {
  return extractTags(xml, localName)[0];
}

function serviceCode(xml: string): string | undefined {
  return firstTag(xml, "code");
}

/**
 * Parse ATC sellable productId: STYLE(Color,Size,) or STYLE(Color,Size,C)
 */
export function parseSellableProductId(raw: string): {
  styleId: string;
  colorName: string;
  sizeName: string;
  discontinued: boolean;
} | null {
  const match = raw.match(/^([^(]+)\((.*)\)$/);
  if (!match) {
    const styleId = raw.trim();
    return styleId
      ? { styleId, colorName: "Standard", sizeName: "OSFA", discontinued: false }
      : null;
  }
  const styleId = match[1]!.trim();
  const parts = match[2]!.split(",").map((p) => p.trim());
  const colorName = parts[0] || "Standard";
  const sizeName = parts[1] || "OSFA";
  const flag = (parts[2] || "").toUpperCase();
  const discontinued = ["S", "M", "X", "C"].includes(flag);
  return { styleId, colorName, sizeName, discontinued };
}

/**
 * SanMar Canada / ATC PromoStandards SOAP + EDI client.
 */
export class SanmarClient {
  private readonly endpoints: {
    productData: string;
    inventory: string;
  };
  rateLimitRemaining: number | null = null;

  constructor(private readonly options: SanmarClientOptions) {
    const base = (options.baseUrl || "https://edi.atc-apparel.com").replace(
      /\/$/,
      "",
    );
    this.endpoints = {
      productData: `${base}/pstd/productdata2.0/ProductDataServiceV2.php`,
      inventory: `${base}/pstd/inventory2.0/InventoryServiceV2.php`,
    };
  }

  get accountId() {
    return this.options.accountId;
  }

  validateCredentials(): boolean {
    return Boolean(
      this.options.accountId &&
        this.options.loginEmail &&
        this.options.loginEmail.includes("@"),
    );
  }

  /**
   * Build catalog products via getProduct. Prefer an explicit productIds list;
   * otherwise discover styles from sellable ACTIVE and hydrate up to maxProducts.
   * Full catalog sync should upsert sellable parts first and call getProduct
   * only for optional enrichment (see SanmarSyncService).
   */
  async listProducts(): Promise<SanmarProduct[]> {
    if (this.options.csvDir) {
      const content = await this.readCsvFile("products.csv");
      if (content) return this.parseProductDataCSV(content);
    }

    const styleIds =
      this.options.productIds?.length
        ? this.options.productIds
        : [
            ...new Set(
              (await this.listSellableParts()).map((part) => part.styleId),
            ),
          ];

    const max = this.options.maxProducts ?? 500;
    const limited = styleIds.slice(0, max);
    const products: SanmarProduct[] = [];

    for (const productId of limited) {
      try {
        products.push(await this.getProduct(productId));
      } catch (error) {
        if (error instanceof SanmarNotFoundError) continue;
        if (error instanceof SanmarAuthError) throw error;
      }
    }
    return products;
  }

  async listSellableParts(
    mode: "ACTIVE" | "ALL" = this.options.sellableMode ?? "ACTIVE",
  ): Promise<SanmarSellablePart[]> {
    const xml = await this.postSoap(
      this.endpoints.productData,
      "getProductSellable",
      `<GetProductSellableRequest xmlns="${NS_PD}">
        <wsVersion>2.0.0</wsVersion>
        <id>${escapeXml(this.options.accountId)}</id>
        <password>${escapeXml(this.options.loginEmail)}</password>
        <localizationCountry>CA</localizationCountry>
        <localizationLanguage>en</localizationLanguage>
        <productId>${mode}</productId>
        <partId></partId>
        <lineName></lineName>
        <isSellable>true</isSellable>
      </GetProductSellableRequest>`,
    );

    this.assertAuth(xml);

    const blocks =
      xml.match(
        /<(?:[\w.-]+:)?ProductSellable\b[\s\S]*?<\/(?:[\w.-]+:)?ProductSellable>/gi,
      ) ?? [];

    const parts: SanmarSellablePart[] = [];
    for (const block of blocks) {
      const rawProductId = firstTag(block, "productId");
      const partId = firstTag(block, "partId");
      if (!rawProductId || !partId) continue;
      const parsed = parseSellableProductId(rawProductId);
      if (!parsed) continue;
      parts.push({
        ...parsed,
        partId,
        rawProductId,
      });
    }

    if (parts.length === 0) {
      const code = serviceCode(xml);
      const description =
        firstTag(xml, "description") ||
        "getProductSellable returned no parts";
      throw new SanmarSOAPError(
        code ? `${description} (code ${code})` : description,
        xml.slice(0, 2000),
      );
    }

    return parts;
  }

  async listSellableProductIds(): Promise<string[]> {
    return [
      ...new Set((await this.listSellableParts()).map((part) => part.styleId)),
    ];
  }

  async listSKUsByProduct(productId: string): Promise<SanmarSKU[]> {
    if (this.options.csvDir) {
      const content = await this.readCsvFile("skus.csv");
      if (content) {
        const skus = await this.parseSKUDataCSV(content);
        return skus.filter((sku) => sku.productId === productId);
      }
    }

    const parts = (await this.listSellableParts()).filter(
      (part) => part.styleId === productId,
    );
    if (parts.length > 0) {
      return parts.map((part) => this.sellableToSku(part));
    }

    const product = await this.getProduct(productId);
    const raw = await this.getProductRaw(productId);
    return this.productPartsToSkus(product, raw);
  }

  async listAllSkus(): Promise<SanmarSKU[]> {
    if (this.options.csvDir) {
      const content = await this.readCsvFile("skus.csv");
      if (content) return this.parseSKUDataCSV(content);
    }

    // Sellable ACTIVE is the catalog authority — do not cap SKUs by maxProducts
    // (that knob only limits optional getProduct enrichment).
    const parts = await this.listSellableParts();
    return parts
      .filter((part) => !part.discontinued)
      .map((part) => this.sellableToSku(part));
  }

  async listInventory(): Promise<SanmarInventory[]> {
    if (this.options.csvDir) {
      const content = await this.readCsvFile("inventory.csv");
      if (content) return this.parseInventoryCSV(content);
    }

    const styleIds =
      this.options.productIds?.length
        ? this.options.productIds
        : await this.listSellableProductIds();

    const max = this.options.maxProducts ?? 500;
    const inventory: SanmarInventory[] = [];

    for (const styleId of styleIds.slice(0, max)) {
      try {
        inventory.push(...(await this.getInventoryLevels(styleId)));
      } catch (error) {
        if (error instanceof SanmarAuthError) throw error;
      }
    }
    return inventory;
  }

  async getInventoryLevels(productId: string): Promise<SanmarInventory[]> {
    const xml = await this.postSoap(
      this.endpoints.inventory,
      "getInventoryLevels",
      `<GetInventoryLevelsRequest xmlns="${NS_INV}">
        <wsVersion>2.0.0</wsVersion>
        <id>${escapeXml(this.options.accountId)}</id>
        <password>${escapeXml(this.options.loginEmail)}</password>
        <productId>${escapeXml(productId)}</productId>
      </GetInventoryLevelsRequest>`,
    );
    this.assertAuth(xml);

    const blocks =
      xml.match(
        /<(?:[\w.-]+:)?PartInventory\b[\s\S]*?<\/(?:[\w.-]+:)?PartInventory>/gi,
      ) ?? [];

    return blocks.map((block) => {
      const partId = firstTag(block, "partId") || "";
      const qtyText =
        firstTag(block, "value") ||
        firstTag(block, "Quantity") ||
        firstTag(block, "quantity") ||
        "0";
      return {
        skuId: partId,
        quantity: Number.parseInt(qtyText, 10) || 0,
        lastUpdated: new Date().toISOString(),
      };
    });
  }

  async getProduct(productId: string): Promise<SanmarProduct> {
    const { product } = await this.getProductWithSkus(productId);
    return product;
  }

  /** Single-style hydrate: one getProduct SOAP call → product + part SKUs. */
  async getProductWithSkus(
    productId: string,
  ): Promise<{ product: SanmarProduct; skus: SanmarSKU[] }> {
    const xml = await this.getProductRaw(productId);
    const product = this.parseProductXml(productId, xml);
    if (!product) {
      throw new SanmarNotFoundError(`Product ${productId} not found`);
    }
    return { product, skus: this.productPartsToSkus(product, xml) };
  }

  async getProductRaw(productId: string): Promise<string> {
    const xml = await this.postSoap(
      this.endpoints.productData,
      "getProduct",
      `<GetProductRequest xmlns="${NS_PD}">
        <wsVersion>2.0.0</wsVersion>
        <id>${escapeXml(this.options.accountId)}</id>
        <password>${escapeXml(this.options.loginEmail)}</password>
        <localizationCountry>CA</localizationCountry>
        <localizationLanguage>en</localizationLanguage>
        <productId>${escapeXml(productId)}</productId>
        <partId></partId>
        <colorName></colorName>
      </GetProductRequest>`,
    );
    this.assertAuth(xml);
    if (serviceCode(xml) === "130" || /Product Id not found/i.test(xml)) {
      throw new SanmarNotFoundError(`Product ${productId} not found`);
    }
    return xml;
  }

  async parseProductDataCSV(csvContent: string): Promise<SanmarProduct[]> {
    const products: SanmarProduct[] = [];
    for (const line of csvContent.split(/\r?\n/).filter((l) => l.trim())) {
      if (/^productid/i.test(line)) continue;
      const [productId, productName, brandName, category, basePrice, ...imageUrls] =
        splitCsvLine(line);
      if (!productId || !productName) continue;
      products.push({
        productId,
        productName,
        brandName: brandName || undefined,
        category: category || undefined,
        basePrice: basePrice ? Number.parseFloat(basePrice) : undefined,
        images: imageUrls.filter((url) => url.length > 0),
      });
    }
    return products;
  }

  async parseSKUDataCSV(csvContent: string): Promise<SanmarSKU[]> {
    const skus: SanmarSKU[] = [];
    for (const line of csvContent.split(/\r?\n/).filter((l) => l.trim())) {
      if (/^skuid/i.test(line)) continue;
      const [skuId, productId, sku, colorName, sizeName, quantity, price, imageUrl] =
        splitCsvLine(line);
      if (!skuId || !productId) continue;
      skus.push({
        skuId,
        productId,
        sku: sku || skuId,
        colorName: colorName || "Standard",
        sizeName: sizeName || "One Size",
        quantity: Number.parseInt(quantity || "0", 10) || 0,
        price: price ? Number.parseFloat(price) : undefined,
        imageUrl: imageUrl || undefined,
      });
    }
    return skus;
  }

  async parseInventoryCSV(csvContent: string): Promise<SanmarInventory[]> {
    const inventory: SanmarInventory[] = [];
    for (const line of csvContent.split(/\r?\n/).filter((l) => l.trim())) {
      if (/^skuid/i.test(line)) continue;
      const [skuId, quantity, lastUpdated, price] = splitCsvLine(line);
      if (!skuId) continue;
      inventory.push({
        skuId,
        quantity: Number.parseInt(quantity || "0", 10) || 0,
        lastUpdated: lastUpdated || new Date().toISOString(),
        price: price ? Number.parseFloat(price) : undefined,
      });
    }
    return inventory;
  }

  private sellableToSku(part: SanmarSellablePart): SanmarSKU {
    return {
      skuId: part.partId,
      productId: part.styleId,
      sku: part.partId,
      colorName: part.colorName,
      sizeName: part.sizeName,
      quantity: 0,
      discontinued: part.discontinued,
    };
  }

  private parseProductXml(
    productId: string,
    xml: string,
  ): SanmarProduct | null {
    if (/Authentication Credentials failed/i.test(xml)) {
      throw new SanmarAuthError(
        "Sanmar authentication failed — SANMAR_LOGIN_EMAIL must be the SanMar Canada login e-mail (not the website password)",
      );
    }

    const productName =
      firstTag(xml, "productName") || firstTag(xml, "ProductName");
    if (!productName) return null;

    const colors = [...new Set(extractTags(xml, "colorName"))];
    const sizes = [...new Set(extractTags(xml, "labelSize"))];
    const images = extractTags(xml, "url").filter((u) =>
      /^https?:\/\//i.test(u),
    );

    return {
      productId: firstTag(xml, "productId") || productId,
      productName,
      brandName:
        firstTag(xml, "productBrand") ||
        firstTag(xml, "lineName") ||
        firstTag(xml, "brandName"),
      category:
        firstTag(xml, "category") || firstTag(xml, "productCategory"),
      description:
        firstTag(xml, "description") ||
        firstTag(xml, "productDescription"),
      partNumber: firstTag(xml, "productId") || productId,
      images: [...new Set(images)].slice(0, 8),
      colors: colors.map((colorName) => ({ colorName })),
      sizes: sizes.map((sizeName) => ({ sizeName })),
    };
  }

  private productPartsToSkus(
    product: SanmarProduct,
    rawXml: string,
  ): SanmarSKU[] {
    const partBlocks =
      rawXml.match(
        /<(?:[\w.-]+:)?ProductPart\b[\s\S]*?<\/(?:[\w.-]+:)?ProductPart>/gi,
      ) ?? [];

    if (partBlocks.length === 0) return [];

    return partBlocks.map((block, index) => {
      const partId =
        firstTag(block, "partId") || `${product.productId}-${index + 1}`;
      return {
        skuId: partId,
        productId: product.productId,
        sku: partId,
        colorName:
          firstTag(block, "colorName") ||
          firstTag(block, "standardColorName") ||
          "Standard",
        sizeName: firstTag(block, "labelSize") || "OSFA",
        quantity: 0,
        imageUrl: firstTag(block, "url") || product.images?.[0],
        gtin: firstTag(block, "gtin"),
      };
    });
  }

  private assertAuth(xml: string) {
    const code = serviceCode(xml);
    if (
      code === "105" ||
      code === "110" ||
      code === "100" ||
      code === "104" ||
      /Authentication Credentials failed/i.test(xml)
    ) {
      const description = firstTag(xml, "description");
      throw new SanmarAuthError(
        description ||
          "Sanmar authentication failed. Use customer ID + login e-mail (ATC guide). Also ensure your static IP is whitelisted by edi@sanmarcanada.com.",
      );
    }
  }

  private async postSoap(
    endpoint: string,
    soapAction: string,
    innerBody: string,
  ): Promise<string> {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${innerBody}
  </soap:Body>
</soap:Envelope>`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
        },
        body: envelope,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new SanmarSOAPError(
        `SOAP request failed (${soapAction})`,
        error instanceof Error ? error.message : error,
      );
    }

    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new SanmarAuthError(
        `SOAP authentication failed (${response.status})`,
      );
    }
    if (!response.ok) {
      throw new SanmarSOAPError(
        `SOAP call failed: ${response.status} ${soapAction}`,
        text.slice(0, 2000),
      );
    }
    return text;
  }

  private async readCsvFile(name: string): Promise<string | null> {
    if (!this.options.csvDir) return null;
    try {
      return await readFile(path.join(this.options.csvDir, name), "utf8");
    } catch {
      return null;
    }
  }
}

export function createSanmarClientFromEnv(env: {
  SANMAR_ACCOUNT_ID?: string;
  /** Preferred: SanMar Canada login e-mail (PromoStandards password field). */
  SANMAR_LOGIN_EMAIL?: string;
  /** Legacy alias — must be the login e-mail, not the website password. */
  SANMAR_API_PASSWORD?: string;
  SANMAR_API_BASE_URL?: string;
  SANMAR_CSV_DIR?: string;
  SANMAR_PRODUCT_IDS?: string;
  SANMAR_MAX_PRODUCTS?: string;
  SANMAR_SELLABLE_MODE?: string;
}): SanmarClient | null {
  const loginEmail = env.SANMAR_LOGIN_EMAIL || env.SANMAR_API_PASSWORD;
  if (!env.SANMAR_ACCOUNT_ID || !loginEmail) {
    if (!env.SANMAR_CSV_DIR) return null;
  }
  return new SanmarClient({
    accountId: env.SANMAR_ACCOUNT_ID || "csv",
    loginEmail: loginEmail || "csv@example.com",
    baseUrl: env.SANMAR_API_BASE_URL || "https://edi.atc-apparel.com",
    csvDir: env.SANMAR_CSV_DIR,
    productIds: env.SANMAR_PRODUCT_IDS
      ? env.SANMAR_PRODUCT_IDS.split(/[,\s]+/).filter(Boolean)
      : undefined,
    maxProducts: env.SANMAR_MAX_PRODUCTS
      ? Number.parseInt(env.SANMAR_MAX_PRODUCTS, 10)
      : 500,
    sellableMode:
      env.SANMAR_SELLABLE_MODE?.toUpperCase() === "ALL" ? "ALL" : "ACTIVE",
  });
}
