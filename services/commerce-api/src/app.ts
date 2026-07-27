import {
  CanonicalIdSchema,
  CommerceHeaders,
  CreateJobRequestSchema,
  IdempotencyKeySchema,
  SubmitJobRequestSchema,
  TransitionJobRequestSchema,
  type AuthContext,
  type AuthContextPort,
} from "@gwg/contracts";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  DataIntegrityError,
  IdempotencyConflictError,
  JobRequestService,
  ResourceNotFoundError,
  ScopeMismatchError,
} from "./application/job-request-service.js";
import { AuthenticationUnavailableError } from "./auth.js";
import type { Environment } from "./config.js";
import type { CommerceDatabase } from "./db/client.js";
import { InvalidJobRequestTransitionError } from "./domain/job-request-state.js";

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

  if (input.environment.ENABLE_DEV_ADMIN_ROUTES) {
    app.post(
      "/internal/dev/job-requests/:jobRequestId/transition",
      async (request) => {
        const suppliedToken = request.headers["x-dev-admin-token"];
        if (
          typeof suppliedToken !== "string" ||
          suppliedToken !== input.environment.DEV_ADMIN_TOKEN
        ) {
          throw new UnauthorizedError("Invalid development admin token");
        }
        const auth = await input.auth.resolve(request);
        const jobRequestId = CanonicalIdSchema.parse(
          (request.params as { jobRequestId?: string }).jobRequestId,
        );
        const command = TransitionJobRequestSchema.parse(request.body);
        assertScope(auth, command.context);
        return service.transition(jobRequestId, command, {
          type: "staff",
          id: auth.actor.id,
          displayName: "Development admin",
        });
      },
    );
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
      error instanceof IdempotencyConflictError
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
    } else if (error instanceof DataIntegrityError) {
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
