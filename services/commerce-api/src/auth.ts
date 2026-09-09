import {
  CanonicalIdSchema,
  CommerceHeaders,
  type AuthContext,
  type AuthContextPort,
} from "@gwg/contracts";
import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Environment } from "./config.js";

/** Staging GWG test UUIDs used when env vars are not set. */
const FALLBACK_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const FALLBACK_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const FALLBACK_STORE_ID = "33333333-3333-4333-8333-333333333333";

export class AuthenticationUnavailableError extends Error {
  readonly code = "AUTHENTICATION_UNAVAILABLE";
}

export class InvalidServiceTokenError extends Error {
  readonly code = "INVALID_SERVICE_TOKEN";
}

/** Compares without leaking how many characters matched. */
export function secretsMatch(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // disclosure, so compare a fixed-width digest of equal length instead.
  if (suppliedBytes.length !== expectedBytes.length) {
    const padded = Buffer.alloc(expectedBytes.length);
    suppliedBytes.copy(padded);
    timingSafeEqual(padded, expectedBytes);
    return false;
  }
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

function readTenantScope(request: FastifyRequest): AuthContext {
  const tenantId = CanonicalIdSchema.parse(
    request.headers[CommerceHeaders.tenantId],
  );
  const accountId = CanonicalIdSchema.parse(
    request.headers[CommerceHeaders.accountId],
  );
  const storeId = CanonicalIdSchema.parse(
    request.headers[CommerceHeaders.storeId],
  );
  const actorIdHeader = request.headers[CommerceHeaders.actorId];

  return {
    tenantId,
    accountId,
    storeId,
    actor: {
      type: "customer",
      id: actorIdHeader ? CanonicalIdSchema.parse(actorIdHeader) : undefined,
    },
  };
}

export class DevelopmentHeaderAuth implements AuthContextPort<FastifyRequest> {
  constructor(private readonly production: boolean) {}

  async resolve(request: FastifyRequest): Promise<AuthContext> {
    if (this.production) {
      throw new AuthenticationUnavailableError(
        "Production authentication is not configured",
      );
    }

    return readTenantScope(request);
  }
}

/**
 * Trusts tenant scope headers only from a caller that proves it is the web
 * tier by presenting a shared bearer token.
 *
 * The headers alone cannot be trusted in production: the load balancer exposes
 * this service on a public port, so anyone who guessed a tenant id could
 * otherwise read another tenant's catalogue and pricing. The token is what
 * makes the headers meaningful, and the Next.js server is the only holder.
 */
export class ServiceTokenAuth implements AuthContextPort<FastifyRequest> {
  constructor(private readonly serviceToken: string) {}

  async resolve(request: FastifyRequest): Promise<AuthContext> {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new InvalidServiceTokenError("Service credentials are required");
    }
    if (!secretsMatch(header.slice("Bearer ".length), this.serviceToken)) {
      throw new InvalidServiceTokenError("Service credentials are not valid");
    }

    return readTenantScope(request);
  }
}

/**
 * Auth handler for storefront pricing endpoints that soft-defaults missing
 * tenant headers when authenticated with a valid COMMERCE_SERVICE_TOKEN.
 *
 * This enables external connectors (e.g. Cod Chat) that can send a bearer
 * token but cannot set custom headers to call the pricing/quote endpoint.
 *
 * Priority:
 * 1. Use provided headers if present
 * 2. Use environment variables if set (STOREFRONT_DEFAULT_TENANT_ID, etc.)
 * 3. Fall back to staging GWG test UUIDs
 */
export class StorefrontQuoteAuth implements AuthContextPort<FastifyRequest> {
  constructor(
    private readonly serviceToken: string,
    private readonly environment: Pick<
      Environment,
      | "STOREFRONT_DEFAULT_TENANT_ID"
      | "STOREFRONT_DEFAULT_ACCOUNT_ID"
      | "STOREFRONT_DEFAULT_STORE_ID"
    >,
  ) {}

  async resolve(request: FastifyRequest): Promise<AuthContext> {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new InvalidServiceTokenError("Service credentials are required");
    }
    if (!secretsMatch(header.slice("Bearer ".length), this.serviceToken)) {
      throw new InvalidServiceTokenError("Service credentials are not valid");
    }

    return this.readTenantScopeWithDefaults(request);
  }

  private readTenantScopeWithDefaults(request: FastifyRequest): AuthContext {
    const rawTenantId = request.headers[CommerceHeaders.tenantId];
    const rawAccountId = request.headers[CommerceHeaders.accountId];
    const rawStoreId = request.headers[CommerceHeaders.storeId];
    const actorIdHeader = request.headers[CommerceHeaders.actorId];

    const tenantId = this.resolveHeader(
      rawTenantId,
      this.environment.STOREFRONT_DEFAULT_TENANT_ID,
      FALLBACK_TENANT_ID,
    );
    const accountId = this.resolveHeader(
      rawAccountId,
      this.environment.STOREFRONT_DEFAULT_ACCOUNT_ID,
      FALLBACK_ACCOUNT_ID,
    );
    const storeId = this.resolveHeader(
      rawStoreId,
      this.environment.STOREFRONT_DEFAULT_STORE_ID,
      FALLBACK_STORE_ID,
    );

    return {
      tenantId,
      accountId,
      storeId,
      actor: {
        type: "customer",
        id: actorIdHeader ? CanonicalIdSchema.parse(actorIdHeader) : undefined,
      },
    };
  }

  private resolveHeader(
    header: string | string[] | undefined,
    envDefault: string | undefined,
    fallback: string,
  ): string {
    if (typeof header === "string" && header.length > 0) {
      return CanonicalIdSchema.parse(header);
    }
    if (envDefault) {
      return envDefault;
    }
    return fallback;
  }
}
