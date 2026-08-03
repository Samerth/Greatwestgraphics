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
import { loadCommerceWebEnvironment } from "./config";
import { resolveStoreContext } from "./store-context";
import { getCustomerSession } from "@/lib/auth/session";

export class CommerceApiError extends Error {
  constructor(
    message: string,
    readonly code = "COMMERCE_API_ERROR",
    readonly status = 500,
  ) {
    super(message);
  }
}

export type CommerceIdentity = {
  tenantId: string;
  accountId: string;
  storeId: string;
  customerPersonId: string;
};

export class CommerceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly identity: CommerceIdentity,
  ) {}

  private headers(idempotencyKey?: string, adminToken?: string): HeadersInit {
    return {
      "content-type": "application/json",
      [CommerceHeaders.tenantId]: this.identity.tenantId,
      [CommerceHeaders.accountId]: this.identity.accountId,
      [CommerceHeaders.storeId]: this.identity.storeId,
      [CommerceHeaders.actorId]: this.identity.customerPersonId,
      ...(idempotencyKey
        ? { [CommerceHeaders.idempotencyKey]: idempotencyKey }
        : {}),
      ...(adminToken ? { "x-dev-admin-token": adminToken } : {}),
    };
  }

  private async request<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    init: RequestInit & { revalidate?: number } = {},
  ): Promise<z.output<TSchema>> {
    let response: Response;
    const { revalidate, ...restInit } = init;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...restInit,
        headers: { ...this.headers(), ...init.headers },
        // Most catalog reads never change within a request lifecycle and
        // are identical across every visitor for a given store, so
        // short-lived revalidation avoids paying a fresh cross-region DB
        // round-trip on every navigation. Mutating/session-specific calls
        // keep the no-store default.
        ...(revalidate !== undefined
          ? { next: { revalidate } }
          : { cache: "no-store" as const }),
        signal: init.signal ?? AbortSignal.timeout(60_000),
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

  linkPerson(profile: {
    system: string;
    externalId: string;
    email: string;
    name: string;
  }): Promise<{ personId: string }> {
    return this.request(
      "/v1/auth/link-person",
      z.object({ personId: z.string() }),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(profile),
      },
    );
  }

  suggestStoreSlug(base: string): Promise<{ slug: string }> {
    return this.request(
      `/v1/accounts/suggest-slug?base=${encodeURIComponent(base)}`,
      z.object({ slug: z.string() }),
      { headers: this.headers() },
    );
  }

  createAccountWithStore(body: {
    personId: string;
    accountName: string;
    storeName: string;
    slug: string;
    accentColor?: string;
    logoUrl?: string;
    tagline?: string;
  }): Promise<{ accountId: string; storeId: string; slug: string }> {
    return this.request(
      "/v1/accounts",
      z.object({ accountId: z.string(), storeId: z.string(), slug: z.string() }),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );
  }

  listMyMemberships(personId: string) {
    return this.request(
      `/v1/people/${encodeURIComponent(personId)}/memberships`,
      z.array(
        z.object({
          accountId: z.string(),
          accountName: z.string(),
          role: z.string(),
          storeId: z.string(),
          storeName: z.string(),
          storeSlug: z.string(),
          storeStatus: z.string(),
        }),
      ),
      { headers: this.headers() },
    );
  }

  createAccountInvite(
    accountId: string,
    inviterPersonId: string,
    email: string,
  ): Promise<{ token: string; accountName: string }> {
    return this.request(
      `/v1/accounts/${encodeURIComponent(accountId)}/invites`,
      z.object({ token: z.string(), accountName: z.string() }),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ inviterPersonId, email }),
      },
    );
  }

  getAccountInvite(token: string) {
    return this.request(
      `/v1/accounts/invites/${encodeURIComponent(token)}`,
      z.object({
        email: z.string(),
        accountId: z.string(),
        status: z.string(),
        expiresAt: z.string(),
      }),
      { headers: this.headers() },
    );
  }

  acceptAccountInvite(
    token: string,
    personId: string,
    personEmail: string,
  ): Promise<{ accountId: string }> {
    return this.request(
      `/v1/accounts/invites/${encodeURIComponent(token)}/accept`,
      z.object({ accountId: z.string() }),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ personId, personEmail }),
      },
    );
  }

  listPendingStores(adminToken: string) {
    return this.request(
      "/admin/accounts/pending",
      z.array(z.record(z.unknown())),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  listAllStores(adminToken: string) {
    return this.request(
      "/admin/accounts/all",
      z.array(z.record(z.unknown())),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  getStore(storeId: string, adminToken: string) {
    return this.request(
      `/admin/accounts/stores/${encodeURIComponent(storeId)}`,
      z.record(z.unknown()),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  setStoreStatus(
    storeId: string,
    status: "active" | "suspended",
    adminToken: string,
  ) {
    return this.request(
      `/admin/accounts/stores/${encodeURIComponent(storeId)}/status`,
      z.record(z.unknown()),
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({ status }),
      },
    );
  }

  getStoreCategoryVisibility(storeId: string, adminToken: string) {
    return this.request(
      `/admin/accounts/stores/${encodeURIComponent(storeId)}/category-visibility`,
      z.object({ categoryIds: z.array(z.string()).nullable() }),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  setStoreCategoryVisibility(
    storeId: string,
    categoryIds: string[],
    adminToken: string,
  ) {
    return this.request(
      `/admin/accounts/stores/${encodeURIComponent(storeId)}/category-visibility`,
      z.object({ categoryIds: z.array(z.string()).nullable() }),
      {
        method: "PUT",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({ categoryIds }),
      },
    );
  }

  setStorePricingAdjustment(
    storeId: string,
    percent: number | null,
    adminToken: string,
  ) {
    return this.request(
      `/admin/accounts/stores/${encodeURIComponent(storeId)}/pricing-adjustment`,
      z.record(z.unknown()),
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({ percent }),
      },
    );
  }

  listDesignProjects() {
    return this.request("/v1/design-projects", z.array(z.record(z.unknown())), {
      headers: this.headers(),
    });
  }

  getDesignProject(id: string) {
    return this.request(
      `/v1/design-projects/${encodeURIComponent(id)}`,
      z.record(z.unknown()),
      { headers: this.headers() },
    );
  }

  saveDesignProject(body: {
    name: string;
    garmentProductId: string | null;
    artworksBySide: unknown;
    proofImageUrl: string | null;
  }) {
    return this.request("/v1/design-projects", z.record(z.unknown()), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
  }

  updateDesignProject(
    id: string,
    body: Partial<{
      name: string;
      garmentProductId: string | null;
      artworksBySide: unknown;
      proofImageUrl: string | null;
    }>,
  ) {
    return this.request(
      `/v1/design-projects/${encodeURIComponent(id)}`,
      z.record(z.unknown()),
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );
  }

  deleteDesignProject(id: string) {
    return this.request(
      `/v1/design-projects/${encodeURIComponent(id)}`,
      z.record(z.unknown()),
      { method: "DELETE", headers: this.headers() },
    );
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
        tenantId: this.identity.tenantId,
        accountId: this.identity.accountId,
        storeId: this.identity.storeId,
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
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
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
      tenantId: this.identity.tenantId,
      accountId: this.identity.accountId,
      storeId: this.identity.storeId,
    };
    const createCommand = CreateJobRequestSchema.parse({
      context,
      customerPersonId: this.identity.customerPersonId,
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
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
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

  async listCatalogProducts(
    query?: {
      search?: string;
      categoryId?: string;
      limit?: number;
      offset?: number;
      brands?: string[];
      priceMinMinor?: number;
      priceMaxMinor?: number;
    },
    adminToken?: string,
  ): Promise<{ products: Record<string, unknown>[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.categoryId) params.set("categoryId", query.categoryId);
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.offset) params.set("offset", String(query.offset));
    for (const brand of query?.brands ?? []) params.append("brand", brand);
    if (query?.priceMinMinor != null) params.set("priceMin", String(query.priceMinMinor));
    if (query?.priceMaxMinor != null) params.set("priceMax", String(query.priceMaxMinor));
    const qs = params.toString();
    const headers = adminToken
      ? this.headers(undefined, adminToken)
      : this.headers();

    if (adminToken) {
      // /admin/catalog/products is unpaginated — used by the staff catalog
      // page, which doesn't need a page count.
      const products = await this.request(
        `/admin/catalog/products${qs ? `?${qs}` : ""}`,
        z.array(z.record(z.unknown())),
        { headers },
      );
      return { products, total: products.length };
    }

    return this.request(
      `/v1/catalog/products${qs ? `?${qs}` : ""}`,
      z.object({ products: z.array(z.record(z.unknown())), total: z.number() }),
      { headers },
    );
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

  listCategories(adminToken?: string, onlyWithProducts?: boolean) {
    const path = adminToken
      ? "/admin/categories"
      : `/v1/catalog/categories${onlyWithProducts ? "?onlyWithProducts=true" : ""}`;
    return this.request(path, z.array(z.record(z.unknown())), {
      headers: adminToken
        ? this.headers(undefined, adminToken)
        : this.headers(),
      // Admin needs live data when editing; storefront reads can lag a
      // catalog sync by a few minutes with no visible effect.
      revalidate: adminToken ? undefined : 300,
    });
  }

  listBrands() {
    return this.request("/v1/catalog/brands", z.array(z.string()), {
      headers: this.headers(),
      revalidate: 300,
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
          tenantId: this.identity.tenantId,
          accountId: this.identity.accountId,
          storeId: this.identity.storeId,
        },
        type,
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
  }
}

export async function createCommerceClient(): Promise<CommerceClient> {
  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("COMMERCE_API_BASE_URL is required");
  }
  const store = await resolveStoreContext();
  const session = await getCustomerSession();
  // The real signed-in customer's personId, when there is one. Falls back
  // to the dev fixture identity only in development with no session —
  // production has no fake identity, so actor-scoped actions correctly
  // require a real sign-in rather than silently acting as someone else.
  const customerPersonId =
    session?.personId ??
    (process.env.NODE_ENV === "production"
      ? ""
      : loadCommerceWebEnvironment().COMMERCE_DEV_CUSTOMER_PERSON_ID);
  return new CommerceClient(baseUrl, {
    tenantId: store.tenantId,
    accountId: store.accountId,
    storeId: store.storeId,
    customerPersonId,
  });
}
