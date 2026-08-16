import {
  CanonicalIdSchema,
  CommerceHeaders,
  CreateFinalQuoteSchema,
  CreateJobRequestSchema,
  CreateProofVersionSchema,
  DecideProofSchema,
  DesignProjectWriteSchema,
  EphemeralArtworkError,
  FinalQuoteResponseSchema,
  normalizeDesignDocument,
  IdempotencyKeySchema,
  PreviewQuoteV2ResponseSchema,
  PreviewQuoteV2Schema,
  PricingConfigDraftResponseSchema,
  PricingConfigV2DraftResponseSchema,
  PricingConfigV2VersionSummarySchema,
  PricingConfigVersionSummarySchema,
  ProofVersionResponseSchema,
  PublishedPricingConfigV2ResponseSchema,
  PublishPricingConfigSchema,
  PublishPricingConfigV2Schema,
  PublishedPricingConfigResponseSchema,
  RestorePricingConfigDraftSchema,
  RestorePricingConfigV2DraftSchema,
  UpsertPricingConfigV2DraftSchema,
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
import { ProofDecisionError } from "./domain/proof-decision.js";
import {
  applyStorePricingAdjustment,
  PricingConfigService,
} from "./application/pricing-config-service.js";
import {
  applyStorePricingAdjustmentV2,
  PricingConfigV2Service,
} from "./application/pricing-config-v2-service.js";
import { CatalogService } from "./application/catalog-service.js";
import {
  designProjectPatch,
  DesignProjectService,
} from "./application/design-project-service.js";
import { StoreService } from "./application/store-service.js";
import { PersonService } from "./application/person-service.js";
import { AccountService, SlugTakenError } from "./application/account-service.js";
import {
  InviteService,
  NotAccountOwnerError,
  InviteNotFoundError,
  InviteExpiredError,
  InviteEmailMismatchError,
} from "./application/invite-service.js";
import { VendorSyncRegistry } from "./adapters/catalog/registry.js";
import { SsActivewearClient } from "./adapters/ss-activewear/client.js";
import {
  AuthenticationUnavailableError,
  InvalidServiceTokenError,
  secretsMatch,
} from "./auth.js";
import { adminRoutesEnabled, type Environment } from "./config.js";
import type { CommerceDatabase } from "./db/client.js";
import { outboxEvents } from "./db/schema.js";
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

/**
 * Pricing v2 admin contexts carry an optional storeId — pricing is configured
 * per tenant, not per store — so only the tenant and account are checked.
 */
function assertTenantScope(
  auth: AuthContext,
  context: { tenantId: string; accountId: string },
): void {
  if (auth.tenantId !== context.tenantId || auth.accountId !== context.accountId) {
    throw new ScopeMismatchError(
      "Request context does not match the authenticated scope",
    );
  }
}

/** Largest page any catalogue listing will return. */
export const MAX_CATALOG_PAGE_SIZE = 500;

/**
 * Turns a caller-supplied page size into one the database can be trusted with.
 *
 * `limit` was previously passed through as `Number(query.limit)`, unbounded, to
 * a route reachable without authentication. `?limit=1000000` therefore asked
 * Postgres for a million rows, and a non-numeric value passed NaN down into the
 * query. Both are clamped here rather than at each call site so a new listing
 * route cannot reintroduce it.
 */
export function parsePageSize(
  raw: string | undefined,
  fallback: number,
): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_CATALOG_PAGE_SIZE, Math.max(1, Math.trunc(parsed)));
}

/** Same treatment for the offset: negative or NaN offsets are not a valid ask. */
export function parseOffset(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function assertAdmin(request: FastifyRequest, environment: Environment): void {
  const suppliedToken = request.headers["x-dev-admin-token"];
  const expectedToken = environment.ADMIN_API_TOKEN ?? environment.DEV_ADMIN_TOKEN;
  if (
    typeof suppliedToken !== "string" ||
    !expectedToken ||
    !secretsMatch(suppliedToken, expectedToken)
  ) {
    throw new UnauthorizedError("Invalid admin token");
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
  const pricingV2Service = new PricingConfigV2Service(input.db);
  const catalogService = new CatalogService(input.db);
  const designProjectService = new DesignProjectService(input.db);
  const storeService = new StoreService(
    input.db,
    input.environment.COMMERCE_STOREFRONT_BASE_DOMAIN,
  );
  const personService = new PersonService(input.db);
  const accountService = new AccountService(input.db);
  const inviteService = new InviteService(input.db);

  function staffActor(auth: AuthContext) {
    return {
      type: "staff" as const,
      id: auth.actor.id,
      displayName: "Development admin",
    };
  }

  /**
   * The signed-in customer behind this request. Every route that returns or
   * mutates one customer's own records must go through this rather than
   * settling for the account scope, which is shared across retail shoppers.
   */
  function requirePersonId(auth: AuthContext): string {
    if (!auth.actor.id) {
      throw new UnauthorizedError("Sign in to view your account");
    }
    return auth.actor.id;
  }

  /**
   * Ties a person id taken from a request body or path to the caller who
   * actually authenticated.
   *
   * Several routes were written to read the acting person out of the payload.
   * The web tier always fills that in from the session, so the storefront
   * behaves correctly, but the payload is not a credential: every caller shares
   * one service token, so a claimed id was accepted as proof of being that
   * person. That let a request invite teammates as an account owner, accept an
   * invite on somebody else's behalf, or read another person's memberships.
   * `/v1` actors are always customers (see `readTenantScope`), so there is no
   * staff path through here to accommodate.
   */
  function assertActorIsPerson(auth: AuthContext, personId: string): void {
    if (requirePersonId(auth) !== personId) {
      throw new UnauthorizedError(
        "Request acts on behalf of a different person than the signed-in one",
      );
    }
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

  const vendorRegistry = new VendorSyncRegistry(input.db, input.environment);

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

  app.post("/v1/contact-requests", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const body = z
      .object({
        name: z.string().min(2).max(200),
        email: z.string().email(),
        phone: z.string().max(50).optional(),
        company: z.string().max(200).optional(),
        topic: z.string().min(2).max(100),
        details: z.string().min(10).max(4_000),
      })
      .parse(request.body);

    const contactId = randomUUID();
    const occurredAt = new Date();
    await input.db.insert(outboxEvents).values({
      id: randomUUID(),
      tenantId: auth.tenantId,
      accountId: auth.accountId,
      aggregateType: "contact_request",
      aggregateId: contactId,
      eventType: "commerce.contact_request.received.v1",
      payload: {
        id: randomUUID(),
        type: "commerce.contact_request.received.v1",
        version: 1,
        aggregateId: contactId,
        tenantId: auth.tenantId,
        accountId: auth.accountId,
        occurredAt: occurredAt.toISOString(),
        actor: auth.actor,
        source: { system: "storefront" },
        data: body,
      },
      occurredAt,
    });

    return reply.code(201).send({ id: contactId, status: "received" });
  });

  app.get("/pricing-config/published", async (request) => {
    const auth = await input.auth.resolve(request);
    const published = await pricingService.getPublished(auth.tenantId);
    const store = await storeService
      .getById(auth.tenantId, auth.storeId)
      .catch(() => null);
    const config = store
      ? applyStorePricingAdjustment(
          published.config,
          store.pricingAdjustmentPercent,
        )
      : published.config;
    return PublishedPricingConfigResponseSchema.parse({
      ...published,
      config,
    });
  });

  // Storefront-facing: the quote builder needs live prices without an admin
  // token. Read-only, and the store adjustment is applied server-side so a
  // negotiated rate can't be tampered with in the browser.
  app.get("/pricing/v2/published", async (request) => {
    const auth = await input.auth.resolve(request);
    const published = await pricingV2Service.getPublished(auth.tenantId);
    const store = await storeService
      .getById(auth.tenantId, auth.storeId)
      .catch(() => null);
    return PublishedPricingConfigV2ResponseSchema.parse({
      ...published,
      config: store
        ? applyStorePricingAdjustmentV2(
            published.config,
            store.pricingAdjustmentPercent,
          )
        : published.config,
    });
  });

  app.post("/v1/job-requests", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const command = CreateJobRequestSchema.parse(request.body);
    assertScope(auth, command.context);
    assertActorIsPerson(auth, command.customerPersonId);
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

  // Customer-facing job reads are scoped to the signed-in person, not just to
  // the account. The public storefront puts every retail shopper into one
  // shared account, so account scope alone would show each customer everyone
  // else's jobs — contact details, addresses, rosters and proofs included.
  app.get("/v1/job-requests", async (request) => {
    const auth = await input.auth.resolve(request);
    return service.list(auth.tenantId, auth.accountId, requirePersonId(auth));
  });

  app.get("/v1/job-requests/:jobRequestId", async (request) => {
    const auth = await input.auth.resolve(request);
    const jobRequestId = CanonicalIdSchema.parse(
      (request.params as { jobRequestId?: string }).jobRequestId,
    );
    return service.get(
      auth.tenantId,
      auth.accountId,
      jobRequestId,
      requirePersonId(auth),
    );
  });

  // The customer half of the proof round trip. The service refuses a decision
  // from the side that raised the proof, so this cannot be used to self-approve
  // artwork that staff have not looked at yet.
  app.post(
    "/v1/job-requests/:jobRequestId/proofs/:proofId/decision",
    async (request) => {
      const auth = await input.auth.resolve(request);
      const jobRequestId = CanonicalIdSchema.parse(
        (request.params as { jobRequestId?: string }).jobRequestId,
      );
      const proofId = CanonicalIdSchema.parse(
        (request.params as { proofId?: string }).proofId,
      );
      const command = DecideProofSchema.parse(request.body);
      assertScope(auth, command.context);
      const decided = await service.decideProof(
        jobRequestId,
        proofId,
        command,
        { ...auth.actor, type: "customer" as const },
      );
      return ProofVersionResponseSchema.parse(decided);
    },
  );

  app.get("/v1/catalog/products", async (request) => {
    const auth = await input.auth.resolve(request);
    const query = request.query as {
      search?: string;
      categoryId?: string;
      limit?: string;
      offset?: string;
      brand?: string | string[];
      priceMin?: string;
      priceMax?: string;
    };
    const brands = query.brand
      ? Array.isArray(query.brand)
        ? query.brand
        : [query.brand]
      : undefined;
    const filters = {
      search: query.search,
      categoryId: query.categoryId,
      storeId: auth.storeId,
      brands,
      priceMinMinor: query.priceMin ? Number(query.priceMin) : undefined,
      priceMaxMinor: query.priceMax ? Number(query.priceMax) : undefined,
      // Soft-hidden colorways are omitted from storefront PLP (not shown
      // as Unavailable). Staff hide = storefront_visible, not vendor active.
      storefrontOnly: true as const,
    };
    const limit = parsePageSize(query.limit, 50);
    const offset = parseOffset(query.offset);
    const [products, total] = await Promise.all([
      catalogService.listProducts(auth.tenantId, { ...filters, limit, offset }),
      catalogService.countProducts(auth.tenantId, filters),
    ]);
    return { products, total };
  });

  app.get("/v1/catalog/brands", async (request) => {
    const auth = await input.auth.resolve(request);
    return catalogService.listBrands(auth.tenantId);
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
    const onlyWithProducts = (request.query as { onlyWithProducts?: string })
      .onlyWithProducts === "true";
    return catalogService.listCategories(auth.tenantId, auth.storeId, onlyWithProducts);
  });

  app.get("/v1/design-projects", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = requirePersonId(auth);
    return designProjectService.list(auth.tenantId, personId);
  });

  app.get("/v1/design-projects/:id", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = requirePersonId(auth);
    const id = CanonicalIdSchema.parse(
      (request.params as { id?: string }).id,
    );
    return designProjectService.get(auth.tenantId, personId, id);
  });

  app.post("/v1/design-projects", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = requirePersonId(auth);
    const body = DesignProjectWriteSchema.parse(request.body);
    return designProjectService.save(
      auth.tenantId,
      personId,
      {
        name: body.name ?? "Untitled design",
        garmentProductId: body.garmentProductId ?? null,
        design: normalizeDesignDocument(body.design ?? body.artworksBySide),
        proofImageUrl: body.proofImageUrl ?? null,
      },
      { type: "customer", id: personId, displayName: "Customer" },
    );
  });

  app.put("/v1/design-projects/:id", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = requirePersonId(auth);
    const id = CanonicalIdSchema.parse(
      (request.params as { id?: string }).id,
    );
    const body = DesignProjectWriteSchema.parse(request.body);
    return designProjectService.update(
      auth.tenantId,
      personId,
      id,
      designProjectPatch(body),
    );
  });

  app.delete("/v1/design-projects/:id", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = requirePersonId(auth);
    const id = CanonicalIdSchema.parse(
      (request.params as { id?: string }).id,
    );
    return designProjectService.delete(auth.tenantId, personId, id);
  });

  // Intentionally not tenant-scoped by the caller — resolving tenant/account
  // /store identity from the inbound host IS this route's job.
  app.get("/v1/stores/by-host", async (request, reply) => {
    const query = request.query as { host?: string };
    const host = z.string().min(1).parse(query.host);
    const resolved = await storeService.resolveByHost(host);
    if (!resolved) {
      return reply.code(404).send({
        error: { code: "STORE_NOT_FOUND", message: "No store for this host" },
      });
    }
    return resolved;
  });

  // Path-based branded storefronts: /s/<slug> on the main domain. Scoped to a
  // tenant the caller names, because a slug is only unique inside one.
  app.get("/v1/stores/by-slug", async (request, reply) => {
    const query = request.query as { tenantId?: string; slug?: string };
    const tenantId = CanonicalIdSchema.parse(query.tenantId);
    const slug = z.string().min(1).max(63).parse(query.slug);
    const resolved = await storeService.resolveBySlug(tenantId, slug);
    if (!resolved) {
      return reply.code(404).send({
        error: { code: "STORE_NOT_FOUND", message: "No store with this slug" },
      });
    }
    return resolved;
  });

  app.post("/v1/auth/link-person", async (request) => {
    const auth = await input.auth.resolve(request);
    const body = z
      .object({
        system: z.string().min(1),
        externalId: z.string().min(1),
        email: z.string().email(),
        name: z.string().min(1),
      })
      .parse(request.body);
    const store = await storeService.getById(auth.tenantId, auth.storeId);
    const isPublicStore = !store.accentColor && !store.logoUrl;
    return personService.findOrCreateByExternalIdentity(
      auth.tenantId,
      auth.accountId,
      isPublicStore,
      body.system,
      body.externalId,
      { email: body.email, name: body.name },
    );
  });

  app.get("/v1/accounts/suggest-slug", async (request) => {
    const auth = await input.auth.resolve(request);
    const query = request.query as { base?: string };
    const base = z.string().min(1).parse(query.base);
    const slug = await accountService.suggestSlug(auth.tenantId, base);
    return { slug };
  });

  app.post("/v1/accounts", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const body = z
      .object({
        personId: CanonicalIdSchema,
        accountName: z.string().min(1).max(200),
        storeName: z.string().min(1).max(200),
        slug: z
          .string()
          .min(2)
          .max(63)
          .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
        accentColor: z.string().max(20).optional(),
        logoUrl: z.string().url().max(2000).optional(),
        tagline: z.string().max(200).optional(),
      })
      .parse(request.body);
    assertActorIsPerson(auth, body.personId);
    try {
      const result = await accountService.createAccountWithStore(
        auth.tenantId,
        body.personId,
        body,
        { type: "customer", id: body.personId, displayName: body.accountName },
      );
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof SlugTakenError) {
        return reply
          .code(409)
          .send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  app.get("/v1/people/:personId/memberships", async (request) => {
    const auth = await input.auth.resolve(request);
    const personId = CanonicalIdSchema.parse(
      (request.params as { personId?: string }).personId,
    );
    assertActorIsPerson(auth, personId);
    return accountService.listMembershipsForPerson(auth.tenantId, personId);
  });

  app.post("/v1/accounts/:accountId/invites", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const accountId = CanonicalIdSchema.parse(
      (request.params as { accountId?: string }).accountId,
    );
    const body = z
      .object({ inviterPersonId: CanonicalIdSchema, email: z.string().email() })
      .parse(request.body);
    assertActorIsPerson(auth, body.inviterPersonId);
    try {
      const result = await inviteService.createInvite(
        auth.tenantId,
        accountId,
        body.inviterPersonId,
        body.email,
        { type: "customer", id: body.inviterPersonId },
      );
      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof NotAccountOwnerError) {
        return reply
          .code(403)
          .send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  // Resolving a token to the address it was sent to is a disclosure, so it
  // needs the same service credential as everything else. This was the one
  // /v1 route that never authenticated at all, and the API answers on a public
  // listener, so anyone holding a token could read the invited email and the
  // account it belongs to without presenting anything.
  app.get("/v1/accounts/invites/:token", async (request, reply) => {
    await input.auth.resolve(request);
    const token = z
      .string()
      .min(1)
      .parse((request.params as { token?: string }).token);
    try {
      const invite = await inviteService.getInvite(token);
      return {
        email: invite.email,
        accountId: invite.accountId,
        status: invite.status,
        expiresAt: invite.expiresAt,
      };
    } catch (error) {
      if (error instanceof InviteNotFoundError) {
        return reply
          .code(404)
          .send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  app.post("/v1/accounts/invites/:token/accept", async (request, reply) => {
    const auth = await input.auth.resolve(request);
    const token = z
      .string()
      .min(1)
      .parse((request.params as { token?: string }).token);
    // `personEmail` is still sent by the deployed web tier and is deliberately
    // ignored: the invite is matched against the person's stored address, not
    // against one the caller supplies. Zod drops the unknown key, so the two
    // tiers can be released independently.
    const body = z.object({ personId: CanonicalIdSchema }).parse(request.body);
    assertActorIsPerson(auth, body.personId);
    try {
      const result = await inviteService.acceptInvite(token, body.personId, {
        type: "customer",
        id: body.personId,
      });
      return result;
    } catch (error) {
      if (
        error instanceof InviteNotFoundError ||
        error instanceof InviteExpiredError ||
        error instanceof InviteEmailMismatchError
      ) {
        return reply
          .code(400)
          .send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }
  });

  if (adminRoutesEnabled(input.environment)) {
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

    app.post(
      "/internal/dev/job-requests/:jobRequestId/final-quotes",
      async (request, reply) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const jobRequestId = CanonicalIdSchema.parse(
          (request.params as { jobRequestId?: string }).jobRequestId,
        );
        const command = CreateFinalQuoteSchema.parse(request.body);
        assertScope(auth, command.context);
        const created = await service.createFinalQuote(
          jobRequestId,
          command,
          staffActor(auth),
        );
        return reply
          .code(201)
          .send(FinalQuoteResponseSchema.parse(created));
      },
    );

    app.post(
      "/internal/dev/job-requests/:jobRequestId/proofs",
      async (request, reply) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const jobRequestId = CanonicalIdSchema.parse(
          (request.params as { jobRequestId?: string }).jobRequestId,
        );
        const command = CreateProofVersionSchema.parse(request.body);
        assertScope(auth, command.context);
        const created = await service.createProof(
          jobRequestId,
          command,
          staffActor(auth),
        );
        return reply
          .code(201)
          .send(ProofVersionResponseSchema.parse(created));
      },
    );

    // Staff side of the round trip: sign off on, or push back, artwork the
    // customer submitted. The customer's half lives on the public router below,
    // because it must be reachable with only a customer session.
    app.post(
      "/internal/dev/job-requests/:jobRequestId/proofs/:proofId/decision",
      async (request, reply) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const jobRequestId = CanonicalIdSchema.parse(
          (request.params as { jobRequestId?: string }).jobRequestId,
        );
        const proofId = CanonicalIdSchema.parse(
          (request.params as { proofId?: string }).proofId,
        );
        const command = DecideProofSchema.parse(request.body);
        assertScope(auth, command.context);
        const decided = await service.decideProof(
          jobRequestId,
          proofId,
          command,
          staffActor(auth),
        );
        return reply.code(200).send(ProofVersionResponseSchema.parse(decided));
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

    app.get("/admin/pricing/v2/draft", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return PricingConfigV2DraftResponseSchema.parse(
        await pricingV2Service.getDraft(auth.tenantId),
      );
    });

    app.put("/admin/pricing/v2/draft", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = UpsertPricingConfigV2DraftSchema.parse(request.body);
      assertTenantScope(auth, command.context);
      return PricingConfigV2DraftResponseSchema.parse(
        await pricingV2Service.upsertDraft(command, staffActor(auth)),
      );
    });

    app.get("/admin/pricing/v2/published", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return PublishedPricingConfigV2ResponseSchema.parse(
        await pricingV2Service.getPublished(auth.tenantId),
      );
    });

    app.post("/admin/pricing/v2/publish", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = PublishPricingConfigV2Schema.parse(request.body);
      assertTenantScope(auth, command.context);
      const key = IdempotencyKeySchema.parse(
        request.headers[CommerceHeaders.idempotencyKey],
      );
      return PublishedPricingConfigV2ResponseSchema.parse(
        await pricingV2Service.publish(command, key, staffActor(auth)),
      );
    });

    app.get("/admin/pricing/v2/versions", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return z
        .array(PricingConfigV2VersionSummarySchema)
        .parse(await pricingV2Service.listVersions(auth.tenantId));
    });

    app.post("/admin/pricing/v2/restore", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = RestorePricingConfigV2DraftSchema.parse(request.body);
      assertTenantScope(auth, command.context);
      return PricingConfigV2DraftResponseSchema.parse(
        await pricingV2Service.restoreAsDraft(command, staffActor(auth)),
      );
    });

    app.post("/admin/pricing/v2/preview", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const command = PreviewQuoteV2Schema.parse(request.body);
      assertTenantScope(auth, command.context);
      return PreviewQuoteV2ResponseSchema.parse(
        await pricingV2Service.preview(command),
      );
    });

    app.get("/admin/dashboard", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const dash = await catalogService.dashboard(auth.tenantId);
      const jobs = await service.list(auth.tenantId, auth.accountId);
      return { ...dash, openJobs: jobs.length };
    });

    // Staff browse and repair customer artwork before it reaches the press.
    // Tenant-scoped only — reaching across customers is the point of these
    // three routes, which is exactly why they sit behind `assertAdmin`
    // instead of alongside the customer's own `/v1/design-projects`.
    app.get("/admin/design-projects", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const query = request.query as { limit?: string; offset?: string };
      return designProjectService.listForStaff(auth.tenantId, {
        limit: parsePageSize(query.limit, 50),
        offset: parseOffset(query.offset),
      });
    });

    app.get("/admin/design-projects/:id", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const id = CanonicalIdSchema.parse((request.params as { id?: string }).id);
      return designProjectService.getForStaff(auth.tenantId, id);
    });

    app.put("/admin/design-projects/:id", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const id = CanonicalIdSchema.parse((request.params as { id?: string }).id);
      const body = DesignProjectWriteSchema.parse(request.body);
      return designProjectService.updateForStaff(
        auth.tenantId,
        id,
        designProjectPatch(body),
        staffActor(auth),
      );
    });

    app.get("/admin/accounts/pending", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return accountService.listPendingStores(auth.tenantId);
    });

    app.get("/admin/accounts/all", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      return accountService.listAllStores(auth.tenantId);
    });

    app.get("/admin/accounts/stores/:storeId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const storeId = CanonicalIdSchema.parse(
        (request.params as { storeId?: string }).storeId,
      );
      return storeService.getById(auth.tenantId, storeId);
    });

    app.post("/admin/accounts/stores/:storeId/status", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const storeId = CanonicalIdSchema.parse(
        (request.params as { storeId?: string }).storeId,
      );
      const body = z
        .object({ status: z.enum(["active", "suspended"]) })
        .parse(request.body);
      return accountService.setStoreStatus(auth.tenantId, storeId, body.status);
    });

    app.get(
      "/admin/accounts/stores/:storeId/category-visibility",
      async (request) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const storeId = CanonicalIdSchema.parse(
          (request.params as { storeId?: string }).storeId,
        );
        const categoryIds = await catalogService.getCategoryVisibility(
          auth.tenantId,
          storeId,
        );
        return { categoryIds };
      },
    );

    app.put(
      "/admin/accounts/stores/:storeId/category-visibility",
      async (request) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const storeId = CanonicalIdSchema.parse(
          (request.params as { storeId?: string }).storeId,
        );
        const body = z
          .object({ categoryIds: z.array(z.string().uuid()) })
          .parse(request.body);
        const categoryIds = await catalogService.setCategoryVisibility(
          auth.tenantId,
          storeId,
          body.categoryIds,
          staffActor(auth),
        );
        return { categoryIds };
      },
    );

    app.post(
      "/admin/accounts/stores/:storeId/pricing-adjustment",
      async (request) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const storeId = CanonicalIdSchema.parse(
          (request.params as { storeId?: string }).storeId,
        );
        const body = z
          .object({ percent: z.number().min(-0.9).max(2).nullable() })
          .parse(request.body);
        return storeService.setPricingAdjustment(
          auth.tenantId,
          storeId,
          body.percent,
        );
      },
    );

    app.get("/admin/catalog/products", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const query = request.query as {
        search?: string;
        categoryId?: string;
        limit?: string;
        offset?: string;
        vendor?: string;
        visibility?: string;
        stock?: string;
        brand?: string | string[];
        sort?: string;
      };
      const brands = query.brand
        ? Array.isArray(query.brand)
          ? query.brand
          : [query.brand]
        : undefined;
      const visibility = (
        query.visibility === "visible" ||
        query.visibility === "hidden" ||
        query.visibility === "all"
          ? query.visibility
          : "all"
      ) as "visible" | "hidden" | "all";
      const stock = (
        query.stock === "in" || query.stock === "oos" || query.stock === "any"
          ? query.stock
          : "any"
      ) as "in" | "oos" | "any";
      const sort = (
        query.sort === "style" ||
        query.sort === "stock" ||
        query.sort === "updated" ||
        query.sort === "brand"
          ? query.sort
          : "brand"
      ) as "brand" | "style" | "stock" | "updated";
      const filters = {
        search: query.search,
        categoryId: query.categoryId,
        vendor: query.vendor,
        visibility,
        stock,
        brands,
        sort,
        storefrontOnly: false as const,
      };
      const limit = parsePageSize(query.limit, 50);
      const offset = parseOffset(query.offset);
      const [products, total] = await Promise.all([
        catalogService.listProducts(auth.tenantId, {
          ...filters,
          limit,
          offset,
        }),
        catalogService.countProducts(auth.tenantId, filters),
      ]);
      return { products, total, limit, offset };
    });

    // Static path before :productId so "bulk" is never parsed as a UUID.
    app.post("/admin/catalog/products/bulk", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          productIds: z.array(z.string().uuid()).min(1),
          storefrontVisible: z.boolean(),
        })
        .parse(request.body);
      return catalogService.bulkSetStorefrontVisible(
        auth.tenantId,
        body.productIds,
        body.storefrontVisible,
        staffActor(auth),
      );
    });

    app.get("/admin/catalog/products/:productId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const productId = CanonicalIdSchema.parse(
        (request.params as { productId?: string }).productId,
      );
      return catalogService.getProductDetail(auth.tenantId, productId, {
        includeHiddenColorways: true,
      });
    });

    app.patch("/admin/catalog/products/:productId", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const productId = CanonicalIdSchema.parse(
        (request.params as { productId?: string }).productId,
      );
      const body = z
        .object({
          /** Prefer storefrontVisible for staff soft-hide. */
          storefrontVisible: z.boolean().optional(),
          /** Vendor discontinued flag — not staff soft-hide. */
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
      return catalogService.updateProduct(
        auth.tenantId,
        productId,
        {
          storefrontVisible: body.storefrontVisible,
          active: body.active,
          isDark: body.isDark,
        },
        staffActor(auth),
      );
    });

    app.post(
      "/admin/catalog/products/:productId/refresh",
      async (request) => {
        assertAdmin(request, input.environment);
        const auth = await input.auth.resolve(request);
        const productId = CanonicalIdSchema.parse(
          (request.params as { productId?: string }).productId,
        );
        const detail = await catalogService.getProductDetail(
          auth.tenantId,
          productId,
          { includeHiddenColorways: true },
        );
        const vendor = String(
          (detail.product as { vendor?: string }).vendor || "",
        );
        const style = detail.style as {
          styleId?: number;
          externalKey?: string | null;
        };
        const styleKey =
          style.externalKey ||
          (style.styleId != null ? String(style.styleId) : "");
        if (!styleKey) {
          throw new DataIntegrityError("Product has no style key to refresh");
        }

        const adapter = vendorRegistry.getAdapter(vendor);
        if (!adapter.refreshStyle) {
          throw new DataIntegrityError(
            `Single-style refresh is not available for vendor "${vendor}"`,
          );
        }
        return adapter.refreshStyle(
          { tenantId: auth.tenantId, actor: staffActor(auth) },
          styleKey,
        );
      },
    );

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

    app.get("/admin/catalog/vendors", async (request) => {
      assertAdmin(request, input.environment);
      await input.auth.resolve(request);
      return vendorRegistry.listVendors();
    });

    app.post("/admin/catalog/sync", async (request) => {
      assertAdmin(request, input.environment);
      const auth = await input.auth.resolve(request);
      const body = z
        .object({
          context: RequestContextSchema,
          vendor: z.string().default("ss_activewear"),
          type: z.enum(["full", "inventory", "csv_import"]).default("full"),
          /** Namespace for generic CSV imports (e.g. "acme_blanks"). */
          vendorKey: z.string().optional(),
          csvContent: z.string().optional(),
          csvProducts: z.string().optional(),
          csvSkus: z.string().optional(),
          csvInventory: z.string().optional(),
        })
        .parse(request.body);
      assertScope(auth, body.context);

      const adapter = vendorRegistry.getAdapter(body.vendor, {
        customVendorKey: body.vendorKey,
      });
      const ctx = {
        tenantId: auth.tenantId,
        actor: staffActor(auth),
        csvContent: body.csvContent,
        csvProducts: body.csvProducts,
        csvSkus: body.csvSkus,
        csvInventory: body.csvInventory,
      };

      if (body.type === "inventory") {
        return adapter.runInventorySync(ctx);
      }
      if (body.type === "csv_import") {
        if (!adapter.importCsv) {
          throw new DataIntegrityError(
            `Vendor ${body.vendor} does not support CSV import`,
          );
        }
        return adapter.importCsv(ctx);
      }
      // Keep requireSsClient side-effect for clearer error when SS selected
      // without credentials (registry also checks, this preserves old message).
      if (body.vendor === "ss_activewear") requireSsClient();
      return adapter.runFullSync(ctx);
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
      error instanceof ProofDecisionError ||
      error instanceof EphemeralArtworkError ||
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
    } else if (error instanceof InvalidServiceTokenError) {
      statusCode = 401;
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
