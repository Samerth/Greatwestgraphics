import {
  CheckoutSessionResponseSchema,
  CommerceErrorResponseSchema,
  CommerceHeaders,
  CreateJobRequestSchema,
  FinalQuoteResponseSchema,
  InvoiceRequestResponseSchema,
  JobRequestDetailResponseSchema,
  JobRequestListResponseSchema,
  JobRequestResponseSchema,
  PreviewQuoteV2ResponseSchema,
  PricingConfigDraftResponseSchema,
  PricingConfigV2DraftResponseSchema,
  PricingConfigV2VersionSummarySchema,
  PricingConfigVersionSummarySchema,
  ProofVersionResponseSchema,
  PublishedPricingConfigResponseSchema,
  PublishedPricingConfigV2ResponseSchema,
  SubmitJobRequestSchema,
  type CheckoutSessionResponse,
  type FinalQuoteResponse,
  type InvoiceRequestResponse,
  type JobRequestDetailResponse,
  type JobRequestListResponse,
  type JobRequestResponse,
  type PreviewQuoteV2Response,
  type PricingConfig,
  type PricingConfigDraftResponse,
  type PricingConfigSelector,
  type PricingConfigV2,
  type PricingConfigV2DraftResponse,
  type PricingConfigV2VersionSummary,
  type PricingConfigVersionSummary,
  type ProofVersionResponse,
  type PublishedPricingConfigResponse,
  type PublishedPricingConfigV2Response,
  type QuoteInputV2,
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
    // The commerce API trusts the tenant scope headers below only when the
    // caller proves it is this server. Absent in development, where the API
    // accepts the headers on their own.
    const serviceToken = process.env.COMMERCE_SERVICE_TOKEN;
    return {
      "content-type": "application/json",
      [CommerceHeaders.tenantId]: this.identity.tenantId,
      [CommerceHeaders.accountId]: this.identity.accountId,
      [CommerceHeaders.storeId]: this.identity.storeId,
      [CommerceHeaders.actorId]: this.identity.customerPersonId,
      ...(serviceToken ? { authorization: `Bearer ${serviceToken}` } : {}),
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
          storeIsPublic: z.boolean().optional().default(false),
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

    joinAccount(
    accountId: string,
    personId: string,
  ): Promise<{ accountId: string; storeSlug?: string | null; storeName?: string | null }> {
    return this.request(
      `/v1/accounts/${encodeURIComponent(accountId)}/join`,
      z.object({
        accountId: z.string(),
        storeSlug: z.string().nullable().optional(),
        storeName: z.string().nullable().optional(),
      }),
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ personId }),
      },
    );
  }

  getAccountInvite(token: string) {
    return this.request(
      `/v1/accounts/invites/${encodeURIComponent(token)}`,
      z.object({
        email: z.string(),
        accountId: z.string(),
        accountName: z.string().nullable().optional(),
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
  ): Promise<{ accountId: string; storeSlug?: string | null; storeName?: string | null }> {
    return this.request(
      `/v1/accounts/invites/${encodeURIComponent(token)}/accept`,
      z.object({
        accountId: z.string(),
        storeSlug: z.string().nullable().optional(),
        storeName: z.string().nullable().optional(),
      }),
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
      z.object({
        id: z.string(),
        status: z.string(),
        slug: z.string(),
        name: z.string(),
        accountId: z.string(),
        ownerEmail: z.string().nullable().optional(),
        ownerName: z.string().nullable().optional(),
      }),
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
    garmentProductId?: string | null;
    design?: unknown;
    artworksBySide?: unknown;
    proofImageUrl?: string | null;
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
      design: unknown;
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

  listAdminDesignProjects(
    adminToken: string,
    params?: { limit?: number; offset?: number },
  ) {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined)
      search.set("offset", String(params.offset));
    const qs = search.toString();
    return this.request(
      `/admin/design-projects${qs ? `?${qs}` : ""}`,
      z.array(z.record(z.unknown())),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  getAdminDesignProject(adminToken: string, id: string) {
    return this.request(
      `/admin/design-projects/${encodeURIComponent(id)}`,
      z.record(z.unknown()),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  updateAdminDesignProject(
    adminToken: string,
    id: string,
    body: {
      name?: string;
      garmentProductId?: string | null;
      design?: unknown;
      proofImageUrl?: string | null;
    },
  ) {
    return this.request(
      `/admin/design-projects/${encodeURIComponent(id)}`,
      z.record(z.unknown()),
      {
        method: "PUT",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify(body),
      },
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

  /**
   * Restores an earlier v1 config as the working draft.
   *
   * The caller used to build this request by hand, which meant it carried the
   * dev fixture tenant headers from `COMMERCE_DEV_*` and no service token, so
   * it could only ever have worked on a developer machine.
   */
  restorePricingVersion(
    version: number,
    adminToken: string,
  ): Promise<PricingConfigDraftResponse> {
    return this.request(
      "/admin/pricing-config/restore",
      PricingConfigDraftResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          version,
        }),
      },
    );
  }

  getPricingV2Draft(adminToken: string): Promise<PricingConfigV2DraftResponse> {
    return this.request(
      "/admin/pricing/v2/draft",
      PricingConfigV2DraftResponseSchema,
      { headers: this.headers(undefined, adminToken) },
    );
  }

  /** Storefront-facing published v2 config; no admin token required. */
  getPublishedPricingV2Config(): Promise<PublishedPricingConfigV2Response> {
    return this.request(
      "/pricing/v2/published",
      PublishedPricingConfigV2ResponseSchema,
    );
  }

  getPricingV2Published(
    adminToken: string,
  ): Promise<PublishedPricingConfigV2Response> {
    return this.request(
      "/admin/pricing/v2/published",
      PublishedPricingConfigV2ResponseSchema,
      { headers: this.headers(undefined, adminToken) },
    );
  }

  savePricingV2Draft(
    config: PricingConfigV2,
    adminToken: string,
  ): Promise<PricingConfigV2DraftResponse> {
    return this.request(
      "/admin/pricing/v2/draft",
      PricingConfigV2DraftResponseSchema,
      {
        method: "PUT",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({ context: this.pricingContext(), config }),
      },
    );
  }

  publishPricingV2Draft(
    adminToken: string,
    idempotencyKey: string,
    notes = "",
  ): Promise<PublishedPricingConfigV2Response> {
    return this.request(
      "/admin/pricing/v2/publish",
      PublishedPricingConfigV2ResponseSchema,
      {
        method: "POST",
        headers: this.headers(idempotencyKey, adminToken),
        body: JSON.stringify({
          context: this.pricingContext(),
          notes,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  listPricingV2Versions(
    adminToken: string,
  ): Promise<PricingConfigV2VersionSummary[]> {
    return this.request(
      "/admin/pricing/v2/versions",
      z.array(PricingConfigV2VersionSummarySchema),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  restorePricingV2Version(
    version: number,
    adminToken: string,
  ): Promise<PricingConfigV2DraftResponse> {
    return this.request(
      "/admin/pricing/v2/restore",
      PricingConfigV2DraftResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({ context: this.pricingContext(), version }),
      },
    );
  }

  previewPricingV2Quote(
    quote: QuoteInputV2,
    adminToken: string,
    options: {
      using?: PricingConfigSelector;
      compareWith?: PricingConfigSelector;
    } = {},
  ): Promise<PreviewQuoteV2Response> {
    return this.request(
      "/admin/pricing/v2/preview",
      PreviewQuoteV2ResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({
          context: this.pricingContext(),
          using: options.using ?? { kind: "draft" },
          ...(options.compareWith ? { compareWith: options.compareWith } : {}),
          quote,
        }),
      },
    );
  }

  private pricingContext() {
    return {
      tenantId: this.identity.tenantId,
      accountId: this.identity.accountId,
      storeId: this.identity.storeId,
    };
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

  /**
   * The staff inbox: every job on the account, not just the caller's own.
   * Separate from `listJobRequests` because the customer endpoint is now
   * person-scoped, and staff reading it saw nothing at all.
   */
  listJobRequestsAsStaff(adminToken: string): Promise<JobRequestListResponse> {
    return this.request("/internal/dev/job-requests", JobRequestListResponseSchema, {
      headers: this.headers(undefined, adminToken),
    });
  }

  getJobRequestAsStaff(
    id: string,
    adminToken: string,
  ): Promise<JobRequestDetailResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}`,
      JobRequestDetailResponseSchema,
      { headers: this.headers(undefined, adminToken) },
    );
  }

  issueInvoice(
    id: string,
    note: string | undefined,
    adminToken: string,
  ): Promise<JobRequestResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}/issue-invoice`,
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
          note,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  recordPayment(
    id: string,
    note: string,
    adminToken: string,
  ): Promise<JobRequestResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}/record-payment`,
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
          note,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  transitionJobRequest(
    id: string,
    toStatus: string,
    adminToken: string,
    reason?: string,
    notifyCustomer = true,
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
          notifyCustomer,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  createFinalQuote(
    id: string,
    input: {
      amountMinor: number;
      currency?: string;
      note?: string;
      markAwaitingPayment?: boolean;
    },
    adminToken: string,
  ): Promise<FinalQuoteResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}/final-quotes`,
      FinalQuoteResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          amountMinor: input.amountMinor,
          currency: input.currency ?? "CAD",
          note: input.note,
          markAwaitingPayment: input.markAwaitingPayment ?? false,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  createProof(
    id: string,
    input: {
      storageKey: string;
      note?: string;
      awaitingDecisionFrom?: "customer" | "staff";
    },
    adminToken: string,
  ): Promise<ProofVersionResponse> {
    return this.request(
      `/internal/dev/job-requests/${encodeURIComponent(id)}/proofs`,
      ProofVersionResponseSchema,
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          storageKey: input.storageKey,
          note: input.note,
          awaitingDecisionFrom: input.awaitingDecisionFrom,
          source: { system: "commerce_api" },
        }),
      },
    );
  }

  /**
   * Records a verdict on a proof.
   *
   * The two sides of the round trip hit different routes: staff go through the
   * admin router with an admin token, customers through the public one with
   * their session actor. Passing `adminToken` is what selects the staff path.
   */
  decideProof(
    id: string,
    proofId: string,
    input: { decision: "approved" | "changes_requested"; note?: string },
    options?: { adminToken?: string },
  ): Promise<ProofVersionResponse> {
    const adminToken = options?.adminToken;
    const path = adminToken
      ? `/internal/dev/job-requests/${encodeURIComponent(id)}/proofs/${encodeURIComponent(proofId)}/decision`
      : `/v1/job-requests/${encodeURIComponent(id)}/proofs/${encodeURIComponent(proofId)}/decision`;
    // The customer actor travels in the standard actor header that every
    // request carries, taken from the session. It used to be passed here as
    // well, in the idempotency-key slot, which sent a nonsense key.
    return this.request(path, ProofVersionResponseSchema, {
      method: "POST",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify({
        context: {
          tenantId: this.identity.tenantId,
          accountId: this.identity.accountId,
          storeId: this.identity.storeId,
        },
        decision: input.decision,
        note: input.note,
        source: { system: "commerce_api" },
      }),
    });
  }

  acceptFinalQuote(
    id: string,
    finalQuoteId: string,
  ): Promise<FinalQuoteResponse> {
    return this.request(
      `/v1/job-requests/${encodeURIComponent(id)}/final-quotes/${encodeURIComponent(finalQuoteId)}/accept`,
      FinalQuoteResponseSchema,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          source: { system: "storefront" },
        }),
      },
    );
  }

  respondToChanges(
    id: string,
    input: { note: string; storageKey?: string },
  ): Promise<JobRequestResponse> {
    return this.request(
      `/v1/job-requests/${encodeURIComponent(id)}/respond`,
      JobRequestResponseSchema,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          note: input.note,
          storageKey: input.storageKey,
          source: { system: "storefront" },
        }),
      },
    );
  }

  requestInvoice(id: string): Promise<InvoiceRequestResponse> {
    return this.request(
      `/v1/job-requests/${encodeURIComponent(id)}/invoice-request`,
      InvoiceRequestResponseSchema,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          source: { system: "storefront" },
        }),
      },
    );
  }

  /**
   * Starts a Stripe Checkout Session for this job.
   *
   * Deliberately shaped like `requestInvoice`: same route family, same scope
   * headers, same session actor. The only difference is what comes back — a
   * URL the caller redirects to.
   */
  createCheckoutSession(id: string): Promise<CheckoutSessionResponse> {
    return this.request(
      `/v1/job-requests/${encodeURIComponent(id)}/checkout-session`,
      CheckoutSessionResponseSchema,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          context: {
            tenantId: this.identity.tenantId,
            accountId: this.identity.accountId,
            storeId: this.identity.storeId,
          },
          source: { system: "storefront" },
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
      vendor?: string;
      visibility?: "visible" | "hidden" | "all";
      stock?: "in" | "oos" | "any";
      sort?: "brand" | "style" | "stock" | "updated";
      /** Storefront default is true. Admin lists omit this. */
      groupByStyle?: boolean;
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
    if (query?.vendor) params.set("vendor", query.vendor);
    if (query?.visibility) params.set("visibility", query.visibility);
    if (query?.stock) params.set("stock", query.stock);
    if (query?.sort) params.set("sort", query.sort);
    if (query?.groupByStyle === false) params.set("groupByStyle", "false");
    if (query?.groupByStyle === true) params.set("groupByStyle", "true");
    const qs = params.toString();
    const headers = adminToken
      ? this.headers(undefined, adminToken)
      : this.headers();

    if (adminToken) {
      return this.request(
        `/admin/catalog/products${qs ? `?${qs}` : ""}`,
        z.object({
          products: z.array(z.record(z.unknown())),
          total: z.number(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }),
        { headers },
      );
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
    body: {
      storefrontVisible?: boolean;
      active?: boolean;
      isDark?: boolean;
      categoryIds?: string[];
    },
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

  bulkSetCatalogVisibility(
    body: { productIds: string[]; storefrontVisible: boolean },
    adminToken: string,
  ) {
    return this.request(
      "/admin/catalog/products/bulk",
      z.object({ updated: z.number() }),
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
        body: JSON.stringify(body),
      },
    );
  }

  refreshCatalogProduct(productId: string, adminToken: string) {
    return this.request(
      `/admin/catalog/products/${encodeURIComponent(productId)}/refresh`,
      z.record(z.unknown()),
      {
        method: "POST",
        headers: this.headers(undefined, adminToken),
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
        body: JSON.stringify({}),
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

  listCatalogVendors(adminToken: string) {
    return this.request(
      "/admin/catalog/vendors",
      z.array(
        z.object({
          key: z.string(),
          displayName: z.string(),
          capabilities: z.object({
            fullSync: z.boolean(),
            inventorySync: z.boolean(),
            csvImport: z.boolean(),
          }),
          configured: z.boolean(),
          notes: z.string().optional(),
        }),
      ),
      { headers: this.headers(undefined, adminToken) },
    );
  }

  runCatalogSync(
    input: {
      type: "full" | "inventory" | "csv_import";
      vendor?: string;
      vendorKey?: string;
      csvContent?: string;
      csvProducts?: string;
      csvSkus?: string;
      csvInventory?: string;
    },
    adminToken: string,
  ) {
    return this.request("/admin/catalog/sync", z.record(z.unknown()), {
      method: "POST",
      headers: this.headers(undefined, adminToken),
      body: JSON.stringify({
        context: {
          tenantId: this.identity.tenantId,
          accountId: this.identity.accountId,
          storeId: this.identity.storeId,
        },
        vendor: input.vendor ?? "ss_activewear",
        type: input.type,
        vendorKey: input.vendorKey,
        csvContent: input.csvContent,
        csvProducts: input.csvProducts,
        csvSkus: input.csvSkus,
        csvInventory: input.csvInventory,
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
  }
}

export async function createCommerceClient(
  storeOverride?: Pick<CommerceIdentity, "tenantId" | "accountId" | "storeId">,
): Promise<CommerceClient> {
  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("COMMERCE_API_BASE_URL is required");
  }
  const store = storeOverride ?? (await resolveStoreContext());
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
