import {
  CanonicalIdSchema,
  CommerceHeaders,
  CreateJobRequestSchema,
  IdempotencyKeySchema,
  PricingConfigDraftResponseSchema,
  PricingConfigVersionSummarySchema,
  PublishPricingConfigSchema,
  PublishedPricingConfigResponseSchema,
  RestorePricingConfigDraftSchema,
  SubmitJobRequestSchema,
  TransitionJobRequestSchema,
  UpsertPricingConfigDraftSchema,
  type AuthContext,
  type AuthContextPort,
} from "@gwg/contracts";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  DataIntegrityError,
  IdempotencyConflictError,
  JobRequestService,
  ResourceNotFoundError,
  ScopeMismatchError,
} from "./application/job-request-service.js";
import { PricingConfigService } from "./application/pricing-config-service.js";
import { CatalogService } from "./application/catalog-service.js";
import { SsActivewearClient } from "./adapters/ss-activewear/client.js";
import { SsSyncService } from "./adapters/ss-activewear/sync-service.js";
import { AuthenticationUnavailableError } from "./auth.js";
import type { Environment } from "./config.js";
import type { CommerceDatabase } from "./db/client.js";
import { InvalidJobRequestTransitionError } from "./domain/job-request-state.js";
import { RequestContextSchema } from "@gwg/contracts";

class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
}

function assertScope(
  auth: AuthContext,
  context: { tenantId: string; accountId: string; storeId: string },
): void {
  if (
    auth.tenantId !== context.tenantId ||
    auth.accountId !== context.accountId ||
    auth.storeId !== context.storeId
  ) {
    throw new ScopeMismatchError(
      "Request context does not match the authenticated scope",
    );
  }
}

function assertAdmin(request: FastifyRequest, environment: Environment): void {
  const suppliedToken = request.headers["x-dev-admin-token"];
  if (
    typeof suppliedToken !== "string" ||
    suppliedToken !== environment.DEV_ADMIN_TOKEN
  ) {
    throw new UnauthorizedError("Invalid development admin token");
  }
}

export function buildApp(input: {
  db: CommerceDatabase;
  auth: AuthContextPort<FastifyRequest>;
  environment: Environment;
}) {
  const app = Fastify({
    logger: {
      level: input.environment.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-dev-admin-token",
      ],
    },
    genReqId: (request) => {
      const correlationId = request.headers[CommerceHeaders.correlationId];
      return typeof correlationId === "string" ? correlationId : randomUUID();
    },
  });
  const service = new JobRequestService(input.db);
  const pricingService = new PricingConfigService(input.db);
  const catalogService = new CatalogService(input.db);

  function staffActor(auth: AuthContext) {
    return {
      type: "staff" as const,
      id: auth.actor.id,
      displayName: "Development admin",
    };
  }

  function requireSsClient() {
    if (
      !input.environment.SS_ACCOUNT_NUMBER ||
      !input.environment.SS_API_KEY
    ) {
      throw new DataIntegrityError(
        "SS_ACCOUNT_NUMBER and SS_API_KEY must be configured for catalog sync",
      );
    }
    return new SsActivewearClient(
      input.environment.SS_ACCOUNT_NUMBER,
      input.environment.SS_API_KEY,
      input.environment.SS_API_BASE_URL,
    );
  }

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await input.db.execute(sql`select 1`);
      return { status: "ready" };
    } catch (error) {
      app.log.error({ error }, "Readiness check failed");
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  app.get("/pricing-config/published", async (request) => {
    const auth = await input.auth.resolve(request);
    return PublishedPricingConfigResponseSchema.parse(
      await pricingService.getPublished(auth.tenantId),
    );
  });

  app.post("/v1/job-requests", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const command = CreateJobRequestSchema.parse(request.body);
    assertScope(auth, command.context);
    const key = IdempotencyKeySchema.parse(
      request.headers[CommerceHeaders.idempotencyKey],
    );
    const result = await service.create(command, key, auth.actor);
    return reply.code(201).send(result);
  });

  app.post("/v1/job-requests/:jobRequestId/submit", async (request) => {
    const auth = await input.auth.resolve(request);
    const jobRequestId = CanonicalIdSchema.parse(
      (request.params as { jobRequestId?: string }).jobRequestId,
    );
    const command = SubmitJobRequestSchema.parse(request.body);
    assertScope(auth, command.context);
    const key = IdempotencyKeySchema.parse(
      request.headers[CommerceHeaders.idempotencyKey],
    );
    return service.submit(jobRequestId, command, key, auth.actor);
  });

  app.get("/v1/job-requests", async (request) => {
    const auth = await input.auth.resolve(request);
    return service.list(auth.tenantId, auth.accountId);
  });

  app.get("/v1/job-requests/:jobRequestId", async (request) => {
    const auth = await input.auth.resolve(request);
    const jobRequestId = CanonicalIdSchema.parse(
      (request.params as { jobRequestId?: string }).jobRequestId,
    );
    return service.get(auth.tenantId, auth.accountId, jobRequestId);
  });

  app.get("/v1/catalog/products", async (request) => {
    const auth = await input.auth.resolve(request);
    const query = request.query as {
      search?: string;
      categoryId?: string;
      limit?: string;
    };
    return catalogService.listProducts(auth.tenantId, {
      search: query.search,
      categoryId: query.categoryId,
      limit: query.limit ? Number(query.limit) : 50,
    });
  });

  app.get("/v1/catalog/products/:productId", async (request) => {
    const auth = await input.auth.resolve(request);
    const productId = CanonicalIdSchema.parse(
      (request.params as { productId?: string }).productId,
    );
    return catalogService.getProductDetail(auth.tenantId, productId);
  });

  app.get("/v1/catalog/categories", async (request) => {
    const auth = await input.auth.resolve(request);
    return catalogService.listCategories(auth.tenantId);
  });

  if (input.environment.ENABLE_DEV_ADMIN_ROUTES) {
    app.post(
      "/internal/dev/job-requests/:jobRequestId/transition",
      async (request) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const jobRequestId = CanonicalIdSchema.parse(
          (request.params as { jobRequestId?: string }).jobRequestId,
        );
        const command = TransitionJobRequestSchema.parse(request.body);
        assertScope(auth, command.context);
        return service.transition(jobRequestId, command, staffActor(auth));
      },
    );

    app.get("/admin/pricing-config/draft", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return PricingConfigDraftResponseSchema.parse(
        await pricingService.getDraft(auth.tenantId),
      );
    });

    app.put("/admin/pricing-config/draft", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = UpsertPricingConfigDraftSchema.parse(request.body);
      assertScope(auth, command.context);
      return PricingConfigDraftResponseSchema.parse(
        await pricingService.upsertDraft(command, staffActor(auth)),
      );
    });

    app.post("/admin/pricing-config/publish", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = PublishPricingConfigSchema.parse(request.body);
      assertScope(auth, command.context);
      const key = IdempotencyKeySchema.parse(
        request.headers[CommerceHeaders.idempotencyKey],
      );
      return PublishedPricingConfigResponseSchema.parse(
        await pricingService.publish(command, key, staffActor(auth)),
      );
    });

    app.get("/admin/pricing-config/versions", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return z
        .array(PricingConfigVersionSummarySchema)
        .parse(await pricingService.listVersions(auth.tenantId));
    });

    app.post("/admin/pricing-config/restore", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = RestorePricingConfigDraftSchema.parse(request.body);
      assertScope(auth, command.context);
      return PricingConfigDraftResponseSchema.parse(
        await pricingService.restoreAsDraft(command, staffActor(auth)),
      );
    });

    app.get("/admin/dashboard", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const dash = await catalogService.dashboard(auth.tenantId);
      const jobs = await service.list(auth.tenantId, auth.accountId);
      return { ...dash, openJobs: jobs.length };
    });

    app.get("/admin/catalog/products", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const query = request.query as {
        search?: string;
        categoryId?: string;
        limit?: string;
      };
      return catalogService.listProducts(auth.tenantId, {
        search: query.search,
        categoryId: query.categoryId,
        limit: query.limit ? Number(query.limit) : 100,
      });
    });

    app.get("/admin/catalog/products/:productId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const productId = CanonicalIdSchema.parse(
        (request.params as { productId?: string }).productId,
      );
      return catalogService.getProductDetail(auth.tenantId, productId);
    });

    app.patch("/admin/catalog/products/:productId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const productId = CanonicalIdSchema.parse(
        (request.params as { productId?: string }).productId,
      );
      const body = z
        .object({
          active: z.boolean().optional(),
          isDark: z.boolean().optional(),
          categoryIds: z.array(z.string().uuid()).optional(),
        })
        .parse(request.body);
      if (body.categoryIds) {
        await catalogService.setProductOverrides(
          auth.tenantId,
          productId,
          body.categoryIds,
          staffActor(auth),
        );
      }
      return catalogService.updateProduct(auth.tenantId, productId, {
        active: body.active,
        isDark: body.isDark,
      });
    });

    app.get("/admin/categories", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return catalogService.listCategories(auth.tenantId);
    });

    app.post("/admin/categories", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          name: z.string().min(1),
          slug: z.string().min(1),
          parentId: z.string().uuid().nullable().optional(),
          sortOrder: z.number().int().optional(),
        })
        .parse(request.body);
      return catalogService.createCategory(
        auth.tenantId,
        body,
        staffActor(auth),
      );
    });

    app.patch("/admin/categories/:categoryId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const categoryId = CanonicalIdSchema.parse(
        (request.params as { categoryId?: string }).categoryId,
      );
      const body = z
        .object({
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          parentId: z.string().uuid().nullable().optional(),
          sortOrder: z.number().int().optional(),
        })
        .parse(request.body);
      return catalogService.updateCategory(auth.tenantId, categoryId, body);
    });

    app.delete("/admin/categories/:categoryId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const categoryId = CanonicalIdSchema.parse(
        (request.params as { categoryId?: string }).categoryId,
      );
      await catalogService.deleteCategory(auth.tenantId, categoryId);
      return { ok: true };
    });

    app.put("/admin/categories/reorder", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({ orderedIds: z.array(z.string().uuid()).min(1) })
        .parse(request.body);
      return catalogService.reorderCategories(auth.tenantId, body.orderedIds);
    });

    app.get("/admin/categories/mappings", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return {
        mappings: await catalogService.listMappings(auth.tenantId),
        unmapped: await catalogService.listUnmapped(auth.tenantId),
      };
    });

    app.put("/admin/categories/mappings", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          ssCategoryKey: z.string().min(1),
          ssCategoryLabel: z.string().optional(),
          categoryIds: z.array(z.string().uuid()),
        })
        .parse(request.body);
      return catalogService.upsertMapping(
        auth.tenantId,
        body,
        staffActor(auth),
      );
    });

    app.get("/admin/catalog/settings", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return catalogService.getSettings(auth.tenantId);
    });

    app.put("/admin/catalog/settings", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          retailMarkup: z.string().optional(),
          brandAllowlist: z.array(z.string()).optional(),
        })
        .parse(request.body);
      return catalogService.updateSettings(
        auth.tenantId,
        body,
        staffActor(auth),
      );
    });

    app.get("/admin/catalog/sync-runs", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return catalogService.listSyncRuns(auth.tenantId);
    });

    app.post("/admin/catalog/sync", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          context: RequestContextSchema,
          type: z.enum(["full", "inventory"]).default("full"),
        })
        .parse(request.body);
      assertScope(auth, body.context);
      const sync = new SsSyncService(input.db, requireSsClient());
      if (body.type === "inventory") {
        return sync.runInventorySync(auth.tenantId, staffActor(auth));
      }
      return sync.runFullSync(auth.tenantId, staffActor(auth));
    });
  }

  app.setErrorHandler((error, request, reply) => {
    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";

    if (error instanceof ZodError) {
      statusCode = 400;
      code = "VALIDATION_ERROR";
      message = error.issues.map((issue) => issue.message).join("; ");
    } else if (error instanceof ScopeMismatchError) {
      statusCode = 403;
      code = error.code;
      message = error.message;
    } else if (
      error instanceof InvalidJobRequestTransitionError ||
      error instanceof IdempotencyConflictError ||
      error instanceof DataIntegrityError
    ) {
      statusCode = 409;
      code = error.code;
      message = error.message;
    } else if (error instanceof ResourceNotFoundError) {
      statusCode = 404;
      code = error.code;
      message = error.message;
    } else if (error instanceof AuthenticationUnavailableError) {
      statusCode = 503;
      code = error.code;
      message = error.message;
    } else if (error instanceof UnauthorizedError) {
      statusCode = 401;
      code = error.code;
      message = error.message;
    }

    if (statusCode >= 500) {
      request.log.error({ error, code }, message);
    } else {
      request.log.info({ code }, message);
    }
    return reply.code(statusCode).send({
      error: { code, message, requestId: request.id },
    });
  });

  return app;
}
