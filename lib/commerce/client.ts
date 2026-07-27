import {
  CommerceErrorResponseSchema,
  CommerceHeaders,
  CreateJobRequestSchema,
  JobRequestDetailResponseSchema,
  JobRequestListResponseSchema,
  JobRequestResponseSchema,
  SubmitJobRequestSchema,
  type JobRequestDetailResponse,
  type JobRequestListResponse,
  type JobRequestResponse,
  type StorefrontJobSubmission,
} from "@gwg/contracts";
import type { z } from "zod";
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

  private headers(idempotencyKey?: string): HeadersInit {
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
        signal: AbortSignal.timeout(10_000),
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
}

export function createCommerceClient(): CommerceClient {
  return new CommerceClient(loadCommerceWebEnvironment());
}
