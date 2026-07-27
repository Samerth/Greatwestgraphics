import {
  CanonicalIdSchema,
  CommerceHeaders,
  type AuthContext,
  type AuthContextPort,
} from "@gwg/contracts";
import type { FastifyRequest } from "fastify";

export class AuthenticationUnavailableError extends Error {
  readonly code = "AUTHENTICATION_UNAVAILABLE";
}

export class DevelopmentHeaderAuth implements AuthContextPort<FastifyRequest> {
  constructor(private readonly production: boolean) {}

  async resolve(request: FastifyRequest): Promise<AuthContext> {
    if (this.production) {
      throw new AuthenticationUnavailableError(
        "Production authentication is not configured",
      );
    }

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
}
