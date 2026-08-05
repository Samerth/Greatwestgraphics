import { createHash } from "node:crypto";

export class SanmarAuthError extends Error {
  readonly code = "SANMAR_AUTH_ERROR";
}

export class SanmarNotFoundError extends Error {
  readonly code = "SANMAR_NOT_FOUND";
  constructor(
    message: string,
    readonly productId?: string,
  ) {
    super(message);
  }
}

export class SanmarRateLimitError extends Error {
  readonly code = "SANMAR_RATE_LIMIT";
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

type FetchResult<T> = {
  data: T;
  rateLimitRemaining: number | null;
};

export class SanmarClient {
  private remaining = 60;
  private windowStartedAt = Date.now();
  private requestTimestamps: number[] = [];

  constructor(
    private readonly accountId: string,
    private readonly apiPassword: string,
    private readonly baseUrl = "https://api.sanmarcanada.com",
  ) {}

  get rateLimitRemaining(): number | null {
    return this.remaining;
  }

  async listProducts(): Promise<SanmarProduct[]> {
    const result = await this.getJson<SanmarProduct[]>(
      `/products?accountId=${this.accountId}`,
    );
    return result.data;
  }

  async getProductDetails(productId: string): Promise<SanmarProduct> {
    try {
      const result = await this.getJson<SanmarProduct>(
        `/products/${productId}?accountId=${this.accountId}`,
      );
      return result.data;
    } catch (error) {
      if (error instanceof SanmarNotFoundError) {
        throw new SanmarNotFoundError(`Product ${productId} not found`, productId);
      }
      throw error;
    }
  }

  async listSKUsByProduct(productId: string): Promise<SanmarSKU[]> {
    const result = await this.getJson<SanmarSKU[]>(
      `/products/${productId}/skus?accountId=${this.accountId}`,
    );
    return result.data;
  }

  async getInventory(skuId: string): Promise<SanmarInventory> {
    const result = await this.getJson<SanmarInventory>(
      `/inventory/${skuId}?accountId=${this.accountId}`,
    );
    return result.data;
  }

  async listInventory(): Promise<SanmarInventory[]> {
    const result = await this.getJson<SanmarInventory[]>(
      `/inventory?accountId=${this.accountId}`,
    );
    return result.data;
  }

  private async getJson<T>(path: string): Promise<FetchResult<T>> {
    await this.throttle();
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const authHeader = this.generateAuthHeader();
        const response = await fetch(`${this.baseUrl}${path}`, {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
            "X-Account-ID": this.accountId,
          },
          signal: AbortSignal.timeout(30_000),
        });

        const remainingHeader = response.headers.get("X-Rate-Limit-Remaining");
        if (remainingHeader != null) {
          this.remaining = Number(remainingHeader);
        }

        if (response.status === 401) {
          throw new SanmarAuthError("Sanmar API credentials rejected (401)");
        }
        if (response.status === 429) {
          throw new SanmarRateLimitError("Sanmar API rate limit exceeded");
        }
        if (response.status === 404) {
          throw new SanmarNotFoundError("Sanmar resource not found");
        }
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Sanmar API ${response.status}: ${text.slice(0, 300)}`);
        }

        const data = (await response.json()) as T;
        return { data, rateLimitRemaining: this.remaining };
      } catch (error) {
        if (
          error instanceof SanmarAuthError ||
          error instanceof SanmarNotFoundError ||
          error instanceof SanmarRateLimitError
        ) {
          throw error;
        }
        if (attempt >= 3) throw error;
        await sleep(2 ** attempt * 250);
      }
    }
  }

  private generateAuthHeader(): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha256")
      .update(`${this.accountId}${this.apiPassword}${timestamp}`)
      .digest("hex");
    return `Bearer ${this.accountId}:${signature}:${timestamp}`;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
