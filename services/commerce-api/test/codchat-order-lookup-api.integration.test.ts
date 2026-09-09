import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import {
  accounts,
  jobRequests,
  people,
  stores,
  tenants,
} from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

const DB_TEST_TIMEOUT_MS = 60_000;

// Real, working credential for these tests — not the real production or
// staging secret, which is never read here or anywhere in source.
const CODCHAT_TOKEN = "test-only-codchat-token-not-a-real-secret!!";
const SITE_HOST = `codchat-lookup-${randomUUID()}.integration.test`;
const SITE_BASE_URL = `https://${SITE_HOST}`;

integration("CodChat order-status lookup API", () => {
  const tenantId = randomUUID();
  const accountId = randomUUID();
  const storeId = randomUUID();
  const personId = randomUUID();
  const jobRequestId = randomUUID();
  const orderRef = `GWG-TEST-${randomUUID().slice(0, 8)}`;
  const ownerEmail = "integration-owner@example.test";

  let database: ReturnType<typeof createDatabase>;
  let db: CommerceDatabase;
  let app: FastifyInstance;
  let appWithoutToken: FastifyInstance;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    db = database.db;

    await db.insert(tenants).values({ id: tenantId, name: "CodChat lookup tenant" });
    await db.insert(accounts).values({
      id: accountId,
      tenantId,
      name: "CodChat lookup account",
    });
    await db.insert(stores).values({
      id: storeId,
      tenantId,
      accountId,
      name: "CodChat lookup store",
      slug: `codchat-lookup-${storeId.slice(0, 8)}`,
      // resolveByHost checks custom domain first, so this pins the lookup to
      // exactly this fixture store regardless of any other store's slug.
      customDomain: SITE_HOST,
    });
    await db.insert(people).values({
      id: personId,
      tenantId,
      email: ownerEmail,
    });
    await db.insert(jobRequests).values({
      id: jobRequestId,
      tenantId,
      accountId,
      storeId,
      customerPersonId: personId,
      displayId: orderRef,
      status: "in_production",
    });

    const baseEnvironment = {
      NODE_ENV: "test" as const,
      DATABASE_URL: databaseUrl!,
      COMMERCE_API_HOST: "127.0.0.1",
      COMMERCE_API_PORT: 4000,
      ENABLE_DEV_ADMIN_ROUTES: false,
      SITE_BASE_URL,
    };

    app = buildApp({
      db,
      auth: new DevelopmentHeaderAuth(false),
      environment: {
        ...baseEnvironment,
        CODCHAT_LOOKUP_API_TOKEN: CODCHAT_TOKEN,
      } as never,
    });

    // A second app instance with the token unset, to prove the route is not
    // registered at all rather than registered-but-locked — the "absent a
    // key, no service" shape the route comment describes.
    appWithoutToken = buildApp({
      db,
      auth: new DevelopmentHeaderAuth(false),
      environment: baseEnvironment as never,
    });
  }, DB_TEST_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await appWithoutToken?.close();
    if (!db) return;
    await db.delete(jobRequests).where(eq(jobRequests.tenantId, tenantId));
    await db.delete(people).where(eq(people.tenantId, tenantId));
    await db.delete(stores).where(eq(stores.tenantId, tenantId));
    await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.close();
  }, DB_TEST_TIMEOUT_MS);

  // `null` — not the default-triggering `undefined` — is what actually
  // means "send no Authorization header at all". A caller passing plain
  // `undefined` here would silently fall through to the default token
  // instead of testing an absent one, which is exactly the bug the first
  // run of this file caught in its own "no bearer token" test.
  function lookup(
    query: Record<string, string>,
    authorization: string | null = `Bearer ${CODCHAT_TOKEN}`,
  ) {
    const params = new URLSearchParams(query).toString();
    return app.inject({
      method: "GET",
      url: `/v1/codchat/order-status?${params}`,
      headers: authorization === null ? {} : { authorization },
    });
  }

  it("returns the order status for the verified owner's own email", async () => {
    const response = await lookup({ orderRef, verifiedEmail: ownerEmail });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      orderRef,
      status: "In production",
      updatedAt: expect.any(String),
    });
  });

  it("matches the email case-insensitively", async () => {
    const response = await lookup({
      orderRef,
      verifiedEmail: ownerEmail.toUpperCase(),
    });
    expect(response.statusCode).toBe(200);
  });

  it("returns a generic 404 when the email does not match the order's owner", async () => {
    const response = await lookup({
      orderRef,
      verifiedEmail: "not-the-owner@example.test",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns the identical 404 for an order reference that does not exist", async () => {
    const wrongEmail = await lookup({
      orderRef,
      verifiedEmail: "not-the-owner@example.test",
    });
    const noSuchOrder = await lookup({
      orderRef: "GWG-DOES-NOT-EXIST",
      verifiedEmail: ownerEmail,
    });
    expect(noSuchOrder.statusCode).toBe(wrongEmail.statusCode);
    // requestId is a fresh id per request by design, so it is excluded —
    // code and message are the parts that must be indistinguishable.
    expect(noSuchOrder.json().error.code).toBe(wrongEmail.json().error.code);
    expect(noSuchOrder.json().error.message).toBe(
      wrongEmail.json().error.message,
    );
  });

  it("rejects a request with no bearer token", async () => {
    const response = await lookup({ orderRef, verifiedEmail: ownerEmail }, null);
    expect(response.statusCode).toBe(401);
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await lookup(
      { orderRef, verifiedEmail: ownerEmail },
      "Bearer this-is-not-the-configured-token",
    );
    expect(response.statusCode).toBe(401);
  });

  it("rejects a malformed email with a validation error, not a lookup", async () => {
    const response = await lookup({ orderRef, verifiedEmail: "not-an-email" });
    expect(response.statusCode).toBe(400);
  });

  it("is not registered at all when CODCHAT_LOOKUP_API_TOKEN is unset", async () => {
    const response = await appWithoutToken.inject({
      method: "GET",
      url: `/v1/codchat/order-status?orderRef=${orderRef}&verifiedEmail=${ownerEmail}`,
      headers: { authorization: `Bearer ${CODCHAT_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
