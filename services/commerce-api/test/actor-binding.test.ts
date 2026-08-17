import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { CommerceHeaders } from "@gwg/contracts";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { loadEnvironment } from "../src/config.js";
import type { CommerceDatabase } from "../src/db/client.js";

/**
 * Several `/v1` routes take the person they act for from the request body or
 * path while authenticating from a header. The web tier fills both in from one
 * session, so nothing about the storefront looked wrong — but the body is not a
 * credential. Every caller shares one service token, so a claimed person id was
 * being accepted as proof of being that person, and the owner-only checks
 * downstream were then evaluated against a claim rather than a proof.
 *
 * These cases run without a database on purpose. Rejecting before any query is
 * part of the contract: it is what stops the check from being bypassed by a
 * route that happens to read first, and it keeps a refusal from depending on
 * whether the claimed row exists.
 */
describe("person identity is bound to the authenticated actor", () => {
  const tenantId = randomUUID();
  const accountId = randomUUID();
  const storeId = randomUUID();
  const personId = randomUUID();
  const otherPersonId = randomUUID();

  let touched: string[];
  let app: FastifyInstance;

  // `null` omits the actor header entirely. It cannot be `undefined`, which
  // JavaScript treats as "use the default" and would quietly send the actor.
  const headers = (actor: string | null = personId) => ({
    [CommerceHeaders.tenantId]: tenantId,
    [CommerceHeaders.accountId]: accountId,
    [CommerceHeaders.storeId]: storeId,
    ...(actor === null ? {} : { [CommerceHeaders.actorId]: actor }),
  });

  const jobRequestPayload = (customerPersonId: string) => ({
    context: { tenantId, accountId, storeId },
    customerPersonId,
    contact: {
      email: "binding@example.test",
      fullName: "Binding Customer",
      phone: "6045550100",
    },
    fulfillment: {
      method: "pickup" as const,
      address: {
        address1: "1 Test Street",
        city: "Vancouver",
        region: "BC",
        postalCode: "V6A 1A1",
        country: "Canada",
      },
    },
    lines: [{ description: "Bound", quantity: 1, currency: "CAD" }],
    source: { system: "storefront" as const },
  });

  beforeEach(async () => {
    touched = [];
    // Any use of the database at all is recorded and then fails the request, so
    // a route that reads before checking cannot pass these cases quietly.
    const db = new Proxy(
      {},
      {
        get(_target, property) {
          touched.push(String(property));
          throw new Error(`database touched via ${String(property)}`);
        },
      },
    ) as unknown as CommerceDatabase;

    app = buildApp({
      db,
      auth: new DevelopmentHeaderAuth(false),
      environment: loadEnvironment({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const impersonations = [
    {
      name: "filing a job request as another customer",
      inject: {
        method: "POST" as const,
        url: "/v1/job-requests",
        headers: {
          ...headers(),
          [CommerceHeaders.idempotencyKey]: randomUUID(),
        },
        payload: jobRequestPayload(otherPersonId),
      },
    },
    {
      name: "reading another person's memberships",
      inject: {
        method: "GET" as const,
        url: `/v1/people/${otherPersonId}/memberships`,
        headers: headers(),
      },
    },
    {
      name: "creating an account owned by another person",
      inject: {
        method: "POST" as const,
        url: "/v1/accounts",
        headers: headers(),
        payload: {
          personId: otherPersonId,
          accountName: "Someone Else Co",
          storeName: "Someone Else Store",
          slug: "someone-else",
        },
      },
    },
    {
      name: "inviting a teammate as another person",
      inject: {
        method: "POST" as const,
        url: `/v1/accounts/${accountId}/invites`,
        headers: headers(),
        payload: {
          inviterPersonId: otherPersonId,
          email: "invitee@example.test",
        },
      },
    },
    {
      name: "accepting an invite on another person's behalf",
      inject: {
        method: "POST" as const,
        url: `/v1/accounts/invites/${randomUUID()}/accept`,
        headers: headers(),
        payload: {
          personId: otherPersonId,
          personEmail: "invitee@example.test",
        },
      },
    },
  ];

  for (const { name, inject } of impersonations) {
    it(`refuses ${name}`, async () => {
      const response = await app.inject(inject);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHORIZED");
      expect(touched).toEqual([]);
    });
  }

  it("refuses the same routes when no actor is identified at all", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/people/${personId}/memberships`,
      headers: headers(null),
    });
    expect(response.statusCode).toBe(401);
    expect(touched).toEqual([]);
  });

  // The guard has to be specific rather than a blanket refusal, so confirm a
  // request that acts as itself gets through to the work it asked for.
  it("lets a request act as the person it authenticated as", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/people/${personId}/memberships`,
      headers: headers(),
    });
    expect(response.statusCode).not.toBe(401);
    expect(touched).not.toEqual([]);
  });
});
