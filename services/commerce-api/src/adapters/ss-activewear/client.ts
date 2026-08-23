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

export type SsWarehouseQty = {
  warehouseAbbr?: string;
  skuID?: number;
  qty?: number;
};

export type SsInventoryRow = {
  skuID_Master?: number;
  sku?: string;
  /** Combined qty when present; otherwise sum `warehouses[].qty`. */
  qty?: number;
  warehouses?: SsWarehouseQty[];
};

/** Lightweight products payload for daily stock + cost refresh. */
export type SsStockPriceRow = {
  skuID_Master?: number;
  sku?: string;
  qty?: number;
  customerPrice?: number;
  mapPrice?: number;
};

/**
 * One row from GET /v2/specs/ (https://api.ssactivewear.com/v2/Specs.aspx).
 * Styles and Products do not carry a size-chart URL; this is the measurement
 * feed used to build vendor spec sheets.
 */
export type SsSpec = {
  specID: number;
  styleID: number;
  sizeName: string;
  sizeOrder?: string;
  specName: string;
  value: string;
};

export type SsSizeSpecRow = {
  specId: number;
  sizeName: string;
  sizeOrder: string | null;
  specName: string;
  value: string;
};

type FetchResult<T> = {
  data: T;
  rateLimitRemaining: number | null;
};

const STYLE_FIELDS =
  "styleID,partNumber,brandName,styleName,title,description,baseCategory,categories,brandImage,styleImage";
const PRODUCT_FIELDS =
  "skuID_Master,styleID,sku,gtin,colorName,colorCode,color1,color2,sizeName,sizeCode,sizeOrder,customerPrice,mapPrice,qty,colorFrontImage,colorSideImage,colorBackImage,colorSwatchImage";
const STOCK_PRICE_FIELDS =
  "skuID_Master,sku,qty,customerPrice,mapPrice";
const SPEC_FIELDS = "specID,styleID,sizeName,sizeOrder,specName,value";
const SPECS_STYLE_CHUNK = 40;

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
      `/v2/inventory/?fields=skuID_Master,sku,qty,warehouses`,
    );
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    return rows.map(normalizeInventoryRow);
  }

  /**
   * Bulk stock + CUSTOMER cost in one Products call (Inventory has no price).
   * Prefer this for Admin "Update stock & price".
   */
  /**
   * All spec-sheet rows. Prefer this on a full sync (one request) instead of
   * one call per style.
   */
  async listSpecs(): Promise<SsSpec[]> {
    const result = await this.getJson<unknown>(`/v2/specs/?fields=${SPEC_FIELDS}`);
    return parseSsSpecs(result.data);
  }

  /** Specs for one style (`?style=` accepts StyleID / part number / brand name). */
  async listSpecsByStyle(styleId: number): Promise<SsSpec[]> {
    const result = await this.getJson<unknown>(
      `/v2/specs/?style=${encodeURIComponent(String(styleId))}&fields=${SPEC_FIELDS}`,
    );
    return parseSsSpecs(result.data);
  }

  /**
   * Specs for many styles in chunks. Used when the bulk `/v2/specs/` call
   * fails (timeout / payload) so a full sync does not N+1 every style.
   */
  async listSpecsByStyles(styleIds: number[]): Promise<SsSpec[]> {
    const unique = [
      ...new Set(
        styleIds.filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    const rows: SsSpec[] = [];
    for (let index = 0; index < unique.length; index += SPECS_STYLE_CHUNK) {
      const chunk = unique.slice(index, index + SPECS_STYLE_CHUNK);
      const result = await this.getJson<unknown>(
        `/v2/specs/?style=${chunk.join(",")}&fields=${SPEC_FIELDS}`,
      );
      rows.push(...parseSsSpecs(result.data));
    }
    return rows;
  }

  async listStockAndPrice(): Promise<SsStockPriceRow[]> {
    const result = await this.getJson<SsStockPriceRow[] | SsStockPriceRow>(
      `/v2/products/?fields=${STOCK_PRICE_FIELDS}`,
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

/** Prefer top-level qty; otherwise sum warehouse lines (S&S inventory shape). */
export function sumInventoryQty(row: {
  qty?: number | null;
  warehouses?: Array<{ qty?: number | null; warehouseAbbr?: string }> | null;
}): number {
  if (row.qty != null && Number.isFinite(Number(row.qty))) {
    return Math.max(0, Math.trunc(Number(row.qty)));
  }
  if (!row.warehouses?.length) return 0;
  return row.warehouses.reduce((sum, wh) => {
    const q = wh.qty;
    if (q == null || !Number.isFinite(Number(q))) return sum;
    return sum + Math.max(0, Math.trunc(Number(q)));
  }, 0);
}

export function normalizeInventoryRow(row: SsInventoryRow): SsInventoryRow {
  return {
    ...row,
    qty: sumInventoryQty(row),
  };
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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Parse one S&S specs API object. Skips rows that cannot build a chart cell. */
export function parseSsSpec(raw: unknown): SsSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const styleID = asFiniteNumber(row.styleID);
  const sizeName = asTrimmedString(row.sizeName);
  const specName = asTrimmedString(row.specName);
  if (styleID == null || !sizeName || !specName) return null;
  const specID = asFiniteNumber(row.specID) ?? 0;
  const sizeOrder = asTrimmedString(row.sizeOrder);
  const value = row.value == null ? "" : String(row.value).trim();
  return {
    specID,
    styleID,
    sizeName,
    sizeOrder: sizeOrder ?? undefined,
    specName,
    value,
  };
}

export function parseSsSpecs(payload: unknown): SsSpec[] {
  if (payload == null) return [];
  const rows = Array.isArray(payload) ? payload : [payload];
  const parsed: SsSpec[] = [];
  for (const row of rows) {
    const spec = parseSsSpec(row);
    if (spec) parsed.push(spec);
  }
  return parsed;
}

export function toSizeSpecRow(spec: SsSpec): SsSizeSpecRow {
  return {
    specId: spec.specID,
    sizeName: spec.sizeName,
    sizeOrder: spec.sizeOrder ?? null,
    specName: spec.specName,
    value: spec.value,
  };
}

export function groupSpecsByStyleId(
  specs: SsSpec[],
): Map<number, SsSizeSpecRow[]> {
  const map = new Map<number, SsSizeSpecRow[]>();
  for (const spec of specs) {
    const list = map.get(spec.styleID) ?? [];
    list.push(toSizeSpecRow(spec));
    map.set(spec.styleID, list);
  }
  return map;
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
