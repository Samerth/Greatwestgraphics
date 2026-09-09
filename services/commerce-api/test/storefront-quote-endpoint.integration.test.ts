import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { buildApp } from "../src/app.js";
import { ServiceTokenAuth, StorefrontQuoteAuth } from "../src/auth.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import {
  accounts,
  pricingConfigsV2,
  stores,
  tenants,
} from "../src/db/schema.js";
import { PRICING_MASTER_V2 } from "@gwg/pricing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

const DB_TEST_TIMEOUT_MS = 60_000;
const SERVICE_TOKEN = "test-service-token-at-least-32-chars-long";

const FALLBACK_TENANT = "11111111-1111-4111-8111-111111111111";
const FALLBACK_ACCOUNT = "22222222-2222-4222-8222-222222222222";
const FALLBACK_STORE = "33333333-3333-4333-8333-333333333333";

integration("/pricing/quote endpoint integration", () => {
  const tenantId = FALLBACK_TENANT;
  const accountId = FALLBACK_ACCOUNT;
  const storeId = FALLBACK_STORE;
  let database: ReturnType<typeof createDatabase>;
  let db: CommerceDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    db = database.db;
    await db.insert(tenants).values({ id: tenantId, name: "Test tenant" }).onConflictDoNothing();
    await db.insert(accounts).values({ id: accountId, tenantId, name: "Test account" }).onConflictDoNothing();
    await db.insert(stores).values({ id: storeId, tenantId, accountId, name: "Test store", slug: "test" }).onConflictDoNothing();
    await db.insert(pricingConfigsV2).values({
      id: randomUUID(),
      tenantId,
      version: 1,
      status: "published",
      config: PRICING_MASTER_V2,
      publishedAt: new Date(),
    }).onConflictDoNothing();

    app = buildApp({
      db,
      auth: new ServiceTokenAuth(SERVICE_TOKEN),
      environment: {
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl!,
        COMMERCE_API_HOST: "127.0.0.1",
        COMMERCE_API_PORT: 4000,
        ENABLE_DEV_ADMIN_ROUTES: false,
        COMMERCE_SERVICE_TOKEN: SERVICE_TOKEN,
        STOREFRONT_DEFAULT_TENANT_ID: undefined,
        STOREFRONT_DEFAULT_ACCOUNT_ID: undefined,
        STOREFRONT_DEFAULT_STORE_ID: undefined,
      },
    });
  }, DB_TEST_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await db.delete(pricingConfigsV2).where(eq(pricingConfigsV2.tenantId, tenantId));
    await db.delete(stores).where(eq(stores.tenantId, tenantId));
    await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.close();
  }, DB_TEST_TIMEOUT_MS);

  it("returns 401 without bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      payload: { qty: 48, garment_cost_minor: 800 },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("INVALID_SERVICE_TOKEN");
  });

  it("returns 401 with wrong bearer token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: {
        authorization: "Bearer wrong-token-that-is-definitely-not-valid",
      },
      payload: { qty: 48, garment_cost_minor: 800 },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("INVALID_SERVICE_TOKEN");
  });

  it("soft-defaults tenant headers when valid token but no headers", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: {
        authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      payload: { qty: 48, garment_cost_minor: 800 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.unit_price).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.currency).toBe("CAD");
  });

  it("uses provided headers when present", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: {
        authorization: `Bearer ${SERVICE_TOKEN}`,
        "x-tenant-id": tenantId,
        "x-account-id": accountId,
        "x-store-id": storeId,
      },
      payload: { qty: 48, garment_cost_minor: 800 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.unit_price).toBeGreaterThan(0);
  });

  it("returns quote with decoration pricing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: {
        authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      payload: {
        qty: 24,
        garment_cost_minor: 1000,
        decorations: [
          { method: "screenPrint", location: "front", colours: 2 },
        ],
        rush: false,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.unit_price).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.breakdown).toBeDefined();
    expect(body.breakdown.decoration_per_piece).toBeGreaterThan(0);
  });

  it("applies rush fee when requested", async () => {
    const normalResponse = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { qty: 24, garment_cost_minor: 1000 },
    });

    const rushResponse = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      payload: { qty: 24, garment_cost_minor: 1000, rush: true },
    });

    expect(normalResponse.statusCode).toBe(200);
    expect(rushResponse.statusCode).toBe(200);

    const normalBody = JSON.parse(normalResponse.body);
    const rushBody = JSON.parse(rushResponse.body);

    expect(rushBody.total).toBeGreaterThan(normalBody.total);
    expect(rushBody.breakdown?.rush_total).toBeGreaterThan(0);
  });
});
