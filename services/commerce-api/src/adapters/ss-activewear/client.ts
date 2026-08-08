import { createHash } from "node:crypto";

export class SsAuthError extends Error {
  readonly code = "SS_AUTH_ERROR";
}

export class SsNotFoundError extends Error {
  readonly code = "SS_NOT_FOUND";
  constructor(
    message: string,
    readonly styleId?: number,
  ) {
    super(message);
  }
}

export class SsRateLimitError extends Error {
  readonly code = "SS_RATE_LIMIT";
}

export type SsStyle = {
  styleID: number;
  partNumber?: string;
  brandName: string;
  styleName: string;
  title?: string;
  description?: string;
  baseCategory?: string;
  categories?: string[] | string;
  brandImage?: string;
  styleImage?: string;
};

export type SsProductSku = {
  // S&S's v2 API always returns this as `skuID_Master`, never the documented
  // `skuID` (that name only appears nested per-warehouse in `warehouses[]`).
  skuID_Master: number;
  styleID: number;
  sku: string;
  gtin?: string;
  colorName: string;
  colorCode?: string;
  color1?: string;
  color2?: string;
  sizeName: string;
  sizeCode?: string;
  // Alphanumeric in practice (e.g. "B1".."B6" for extended sizes), not numeric.
  sizeOrder?: string;
  customerPrice?: number;
  mapPrice?: number;
  qty?: number;
  colorFrontImage?: string;
  colorSideImage?: string;
  colorBackImage?: string;
  colorSwatchImage?: string;
};

export type SsCategory = {
  categoryID?: number | string;
  name?: string;
  categoryName?: string;
};

export type SsInventoryRow = {
  skuID_Master?: number;
  sku?: string;
  qty?: number;
};

type FetchResult<T> = {
  data: T;
  rateLimitRemaining: number | null;
};

const STYLE_FIELDS =
  "styleID,partNumber,brandName,styleName,title,description,baseCategory,categories,brandImage,styleImage";
const PRODUCT_FIELDS =
  "skuID_Master,styleID,sku,gtin,colorName,colorCode,color1,color2,sizeName,sizeCode,sizeOrder,customerPrice,mapPrice,qty,colorFrontImage,colorSideImage,colorBackImage,colorSwatchImage";

export class SsActivewearClient {
  private remaining = 60;
  private windowStartedAt = Date.now();
  private requestTimestamps: number[] = [];

  constructor(
    private readonly accountNumber: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api-ca.ssactivewear.com",
  ) {}

  get rateLimitRemaining(): number | null {
    return this.remaining;
  }

  async listStyles(): Promise<SsStyle[]> {
    const result = await this.getJson<SsStyle[] | SsStyle>(
      `/v2/styles/?fields=${STYLE_FIELDS}`,
    );
    return Array.isArray(result.data) ? result.data : [result.data];
  }

  async getStyle(styleId: number): Promise<SsStyle> {
    const result = await this.getJson<SsStyle[] | SsStyle>(
      `/v2/styles/?styleid=${styleId}&fields=${STYLE_FIELDS}`,
    );
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    const style = rows[0];
    if (!style) {
      throw new SsNotFoundError(`Style ${styleId} not found`, styleId);
    }
    return style;
  }

  async listProductsByStyle(styleId: number): Promise<SsProductSku[]> {
    try {
      const result = await this.getJson<SsProductSku[] | SsProductSku>(
        `/v2/products/?styleid=${styleId}&fields=${PRODUCT_FIELDS}`,
      );
      return Array.isArray(result.data) ? result.data : [result.data];
    } catch (error) {
      if (error instanceof SsNotFoundError) {
        throw new SsNotFoundError(
          `Style ${styleId} not found or discontinued`,
          styleId,
        );
      }
      throw error;
    }
  }

  async listCategories(): Promise<SsCategory[]> {
    const result = await this.getJson<SsCategory[] | SsCategory>(
      `/v2/categories/?fields=categoryID,name,categoryName`,
    );
    return Array.isArray(result.data) ? result.data : [result.data];
  }

  async listInventory(): Promise<SsInventoryRow[]> {
    const result = await this.getJson<SsInventoryRow[] | SsInventoryRow>(
      `/v2/inventory/?fields=skuID_Master,sku,qty`,
    );
    return Array.isArray(result.data) ? result.data : [result.data];
  }

  private async getJson<T>(path: string): Promise<FetchResult<T>> {
    await this.throttle();
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.accountNumber}:${this.apiKey}`).toString("base64")}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30_000),
        });
        const remainingHeader = response.headers.get("X-Rate-Limit-Remaining");
        if (remainingHeader != null) {
          this.remaining = Number(remainingHeader);
        }

        if (response.status === 401) {
          throw new SsAuthError("S&S Activewear credentials rejected (401)");
        }
        if (response.status === 429) {
          throw new SsRateLimitError("S&S Activewear rate limit exceeded");
        }
        if (response.status === 404) {
          const body = (await response.json().catch(() => null)) as {
            errors?: Array<{ field?: string }>;
          } | null;
          const identifierMiss = body?.errors?.some(
            (error) => error.field === "Identifier",
          );
          if (identifierMiss || !body) {
            throw new SsNotFoundError("S&S identifier not found");
          }
        }
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`S&S API ${response.status}: ${text.slice(0, 300)}`);
        }
        const data = (await response.json()) as T;
        return { data, rateLimitRemaining: this.remaining };
      } catch (error) {
        if (
          error instanceof SsAuthError ||
          error instanceof SsNotFoundError ||
          error instanceof SsRateLimitError
        ) {
          throw error;
        }
        if (attempt >= 3) throw error;
        await sleep(2 ** attempt * 250);
      }
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (stamp) => now - stamp < 60_000,
    );
    if (this.requestTimestamps.length >= 55 || (this.remaining ?? 60) <= 5) {
      const oldest = this.requestTimestamps[0] ?? now;
      const waitMs = Math.max(0, 60_000 - (now - oldest) + 50);
      await sleep(waitMs);
      this.requestTimestamps = this.requestTimestamps.filter(
        (stamp) => Date.now() - stamp < 60_000,
      );
    }
    this.requestTimestamps.push(Date.now());
  }
}

export function ssImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  // www.ssactivewear.com 301s every image to cdn.ssactivewear.com, so point
  // at the CDN directly — one less hop on every product image request.
  return `https://cdn.ssactivewear.com/${path.replace(/^\//, "")}`;
}

export function pathHash(path: string): string {
  return createHash("sha1").update(path).digest("hex").slice(0, 16);
}

export function dollarsToMinor(value: number | undefined | null): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.round(Number(value) * 100);
}

export function retailFromCost(
  customerPriceMinor: number,
  mapPriceMinor: number | null,
  retailMarkup: number,
): number {
  const marked = Math.round(customerPriceMinor * retailMarkup);
  if (mapPriceMinor == null) return marked;
  return Math.max(mapPriceMinor, marked);
}

export function isDarkHex(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const cleaned = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return false;
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

export function parseSizeOrder(raw: string | undefined | null): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function slugify(...parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
