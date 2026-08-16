import {
  CanonicalIdSchema,
  CommerceHeaders,
  type AuthContext,
  type AuthContextPort,
} from "@gwg/contracts";
import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

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
