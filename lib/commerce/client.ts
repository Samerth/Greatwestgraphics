import {
  CommerceErrorResponseSchema,
  CommerceHeaders,
  CreateJobRequestSchema,
  JobRequestDetailResponseSchema,
  JobRequestListResponseSchema,
  JobRequestResponseSchema,
  PricingConfigDraftResponseSchema,
  PricingConfigVersionSummarySchema,
  PublishedPricingConfigResponseSchema,
  SubmitJobRequestSchema,
  type JobRequestDetailResponse,
  type JobRequestListResponse,
  type JobRequestResponse,
  type PricingConfig,
  type PricingConfigDraftResponse,
  type PricingConfigVersionSummary,
  type PublishedPricingConfigResponse,
  type StorefrontJobSubmission,
  type UpsertPricingConfigDraft,
} from "@gwg/contracts";
import { z } from "zod";
import {
  loadCommerceWebEnvironment,
  type CommerceWebEnvironment,
} from "./config";

export class CommerceApiError extends Error {
  constructor(
    message: string,
    readonly code = "COMMERCE_API_ERROR",
    readonly status = 500,
  ) {
    super(message);
  }
}

export class CommerceClient {
  constructor(private readonly environment: CommerceWebEnvironment) {}

  private headers(idempotencyKey?: string, adminToken?: string): HeadersInit {
    return {
      "content-type": "application/json",
      [CommerceHeaders.tenantId]: this.environment.COMMERCE_DEV_TENANT_ID,
      [CommerceHeaders.accountId]: this.environment.COMMERCE_DEV_ACCOUNT_ID,
      [CommerceHeaders.storeId]: this.environment.COMMERCE_DEV_STORE_ID,
      [CommerceHeaders.actorId]:
        this.environment.COMMERCE_DEV_CUSTOMER_PERSON_ID,
      ...(idempotencyKey
        ? { [CommerceHeaders.idempotencyKey]: idempotencyKey }
        : {}),
      ...(adminToken ? { "x-dev-admin-token": adminToken } : {}),
    };
  }

  private async request<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    init: RequestInit = {},
  ): Promise<z.output<TSchema>> {
    let response: Response;
    try {
      response = await fetch(`${this.environment.COMMERCE_API_BASE_URL}${path}`, {
        ...init,
        headers: { ...this.headers(), ...init.headers },
        cache: "no-store",
        signal: init.signal ?? AbortSignal.timeout(10_000),
      });
    } catch {
      throw new CommerceApiError(
        "The review service is unavailable. Check that the commerce API and database are running, then retry.",
        "COMMERCE_API_UNAVAILABLE",
        503,
      );
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsedError = CommerceErrorResponseSchema.safeParse(payload);
      throw new CommerceApiError(
        parsedError.success
          ? parsedError.data.error.message
          : "The review service could not complete this request.",
        parsedError.success ? parsedError.data.error.code : "COMMERCE_API_ERROR",
        response.status,
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new CommerceApiError(
        "The review service returned an unexpected response.",
        "INVALID_COMMERCE_RESPONSE",
        502,
      );
    }
    return parsed.data;
  }

  getPublishedPricingConfig(): Promise<PublishedPricingConfigResponse> {
    return this.request(
      "/pricing-config/published",
      PublishedPricingConfigResponseSchema,
    );
  }

  getPricingDraft(adminToken: string): Promise<PricingConfigDraftResponse> {
    return this.request(
      "/admin/pricing-config/draft",
      PricingConfigDraftResponseSchema,
      { headers: this.headers(undefined, adminToken) },
    );
  }

  savePricingDraft(
    config: PricingConfig,
    adminToken: string,
  ): Promise<PricingConfigDraftResponse> {
    const body: UpsertPricingConfigDraft = {
      context: {
        tenantId: this.environment.COMMERCE_DEV_TENANT_ID,
        accountId: this.environment.COMMERCE_DEV_ACCOUNT_ID,
        storeId: this.environment.COMMERCE_DEV_STORE_ID,
      },
      config,
    };
    return this.request(
      "/admin/pricing-config/draft",
      PricingConfigDraftResponseSchema,
      {
        method: "PUT",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify(body),
      },
    );
  }

  publishPricingDraft(
    adminToken: string,
    idempotencyKey: string,
  ): Promise<PublishedPricingConfigResponse> {
    return this.request(
      "/admin/pricing-config/publish",
      PublishedPricingConfigResponseSchema,
      {
        method: "POST",
        headers: this.headers(idempotencyKey, adminToken),
        body: JSON.stringify({
          context: {
            tenantId: this.environment.COMMERCE_DEV_TENANT_ID,
            accountId: this.environment.COMMERCE_DEV_ACCOUNT_ID,
            storeId: this.environment.COMMERCE_DEV_STORE_ID,
          },
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  listPricingVersions(
    adminToken: string,
  ): Promise<PricingConfigVersionSummary[]> {
    return this.request(
      "/admin/pricing-config/versions",
      z.array(PricingConfigVersionSummarySchema),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  async submitJobRequest(
    submission: StorefrontJobSubmission,
  ): Promise<JobRequestResponse> {
    const context = {
      tenantId: this.environment.COMMERCE_DEV_TENANT_ID,
      accountId: this.environment.COMMERCE_DEV_ACCOUNT_ID,
      storeId: this.environment.COMMERCE_DEV_STORE_ID,
    };
    const createCommand = CreateJobRequestSchema.parse({
      context,
      customerPersonId: this.environment.COMMERCE_DEV_CUSTOMER_PERSON_ID,
      contact: submission.contact,
      fulfillment: submission.fulfillment,
      customerNote: submission.customerNote,
      lines: submission.lines,
      source: {
        system: "storefront",
        correlationId: submission.idempotencyKey,
      },
    });
    const created = await this.request(
      "/v1/job-requests",
      JobRequestResponseSchema,
      {
        method: "POST",
        headers: this.headers(`${submission.idempotencyKey}:create`),
        body: JSON.stringify(createCommand),
      },
    );
    const submitCommand = SubmitJobRequestSchema.parse({
      context,
      source: {
        system: "storefront",
        correlationId: submission.idempotencyKey,
      },
    });

    return this.request(
      `/v1/job-requests/${created.id}/submit`,
      JobRequestResponseSchema,
      {
        method: "POST",
        headers: this.headers(`${submission.idempotencyKey}:submit`),
        body: JSON.stringify(submitCommand),
      },
    );
  }

  listJobRequests(): Promise<JobRequestListResponse> {
    return this.request("/v1/job-requests", JobRequestListResponseSchema);
  }

  getJobRequest(id: string): Promise<JobRequestDetailResponse> {
    return this.request(
      `/v1/job-requests/${encodeURIComponent(id)}`,
      JobRequestDetailResponseSchema,
    );
  }

  transitionJobRequest(
    id: string,
    toStatus: string,
    adminToken: string,
    reason?: string,
  ): Promise<JobRequestResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}/transition`,
      JobRequestResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({
          context: {
            tenantId: this.environment.COMMERCE_DEV_TENANT_ID,
            accountId: this.environment.COMMERCE_DEV_ACCOUNT_ID,
            storeId: this.environment.COMMERCE_DEV_STORE_ID,
          },
          toStatus,
          reason,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  getAdminDashboard(adminToken: string) {
    return this.request("/admin/dashboard", z.record(z.unknown()), {
      headers: this.headers(undefined, adminToken),
    });
  }

  listCatalogProducts(
    query?: { search?: string; categoryId?: string; limit?: number },
    adminToken?: string,
  ) {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.categoryId) params.set("categoryId", query.categoryId);
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    const path = adminToken
      ? `/admin/catalog/products${qs ? `?${qs}` : ""}`
      : `/v1/catalog/products${qs ? `?${qs}` : ""}`;
    return this.request(path, z.array(z.record(z.unknown())), {
      headers: adminToken
        ? this.headers(undefined, adminToken)
        : this.headers(),
    });
  }

  getCatalogProduct(productId: string, adminToken?: string) {
    const path = adminToken
      ? `/admin/catalog/products/${encodeURIComponent(productId)}`
      : `/v1/catalog/products/${encodeURIComponent(productId)}`;
    return this.request(path, z.record(z.unknown()), {
      headers: adminToken
        ? this.headers(undefined, adminToken)
        : this.headers(),
    });
  }

  patchCatalogProduct(
    productId: string,
    body: { active?: boolean; isDark?: boolean; categoryIds?: string[] },
    adminToken: string,
  ) {
    return this.request(
      `/admin/catalog/products/${encodeURIComponent(productId)}`,
      z.record(z.unknown()),
      {
        method: "PATCH",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify(body),
      },
    );
  }

  listCategories(adminToken?: string) {
    const path = adminToken ? "/admin/categories" : "/v1/catalog/categories";
    return this.request(path, z.array(z.record(z.unknown())), {
      headers: adminToken
        ? this.headers(undefined, adminToken)
        : this.headers(),
    });
  }

  createCategory(
    body: {
      name: string;
      slug: string;
      parentId?: string | null;
      sortOrder?: number;
    },
    adminToken: string,
  ) {
    return this.request("/admin/categories", z.record(z.unknown()), {
      method: "POST",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify(body),
    });
  }

  updateCategory(
    categoryId: string,
    body: Partial<{
      name: string;
      slug: string;
      parentId: string | null;
      sortOrder: number;
    }>,
    adminToken: string,
  ) {
    return this.request(
      `/admin/categories/${encodeURIComponent(categoryId)}`,
      z.record(z.unknown()),
      {
        method: "PATCH",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify(body),
      },
    );
  }

  deleteCategory(categoryId: string, adminToken: string) {
    return this.request(
      `/admin/categories/${encodeURIComponent(categoryId)}`,
      z.object({ ok: z.boolean() }),
      {
        method: "DELETE",
        headers: this.headers(undefined, adminToken),
      },
    );
  }

  reorderCategories(orderedIds: string[], adminToken: string) {
    return this.request("/admin/categories/reorder", z.array(z.record(z.unknown())), {
      method: "PUT",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify({ orderedIds }),
    });
  }

  getCategoryMappings(adminToken: string) {
    return this.request(
      "/admin/categories/mappings",
      z.object({
        mappings: z.array(z.record(z.unknown())),
        unmapped: z.array(z.record(z.unknown())),
      }),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  putCategoryMapping(
    body: {
      ssCategoryKey: string;
      ssCategoryLabel?: string;
      categoryIds: string[];
    },
    adminToken: string,
  ) {
    return this.request("/admin/categories/mappings", z.array(z.record(z.unknown())), {
      method: "PUT",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify(body),
    });
  }

  getCatalogSettings(adminToken: string) {
    return this.request("/admin/catalog/settings", z.record(z.unknown()), {
      headers: this.headers(undefined, adminToken),
    });
  }

  updateCatalogSettings(
    body: { retailMarkup?: string; brandAllowlist?: string[] },
    adminToken: string,
  ) {
    return this.request("/admin/catalog/settings", z.record(z.unknown()), {
      method: "PUT",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify(body),
    });
  }

  listSyncRuns(adminToken: string) {
    return this.request("/admin/catalog/sync-runs", z.array(z.record(z.unknown())), {
      headers: this.headers(undefined, adminToken),
    });
  }

  runCatalogSync(type: "full" | "inventory", adminToken: string) {
    return this.request("/admin/catalog/sync", z.record(z.unknown()), {
      method: "POST",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify({
        context: {
          tenantId: this.environment.COMMERCE_DEV_TENANT_ID,
          accountId: this.environment.COMMERCE_DEV_ACCOUNT_ID,
          storeId: this.environment.COMMERCE_DEV_STORE_ID,
        },
        type,
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
  }
}

export function createCommerceClient(): CommerceClient {
  return new CommerceClient(loadCommerceWebEnvironment());
}
