import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { CommerceHeaders } from "@gwg/contracts";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import {
  accountPeople,
  accounts,
  idempotencyKeys,
  jobRequestLines,
  jobRequests,
  jobRequestSnapshots,
  jobRequestStatusHistory,
  outboxEvents,
  people,
  stores,
  tenants,
} from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

integration("job request API integration", () => {
  const tenantId = randomUUID();
  const accountId = randomUUID();
  const otherAccountId = randomUUID();
  const storeId = randomUUID();
  const otherStoreId = randomUUID();
  const personId = randomUUID();
  let database: ReturnType<typeof createDatabase>;
  let db: CommerceDatabase;
  let app: FastifyInstance;

  const headers = (account = accountId, store = storeId) => ({
    [CommerceHeaders.tenantId]: tenantId,
    [CommerceHeaders.accountId]: account,
    [CommerceHeaders.storeId]: store,
    [CommerceHeaders.actorId]: personId,
  });

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    db = database.db;
    await db.insert(tenants).values({ id: tenantId, name: "Integration tenant" });
    await db.insert(accounts).values([
      { id: accountId, tenantId, name: "Integration account" },
      { id: otherAccountId, tenantId, name: "Other account" },
    ]);
    await db.insert(stores).values([
      { id: storeId, tenantId, accountId, name: "Store", slug: "store" },
      {
        id: otherStoreId,
        tenantId,
        accountId: otherAccountId,
        name: "Other store",
        slug: "other",
      },
    ]);
    await db
      .insert(people)
      .values({ id: personId, tenantId, email: "integration@example.test" });
    await db.insert(accountPeople).values([
      { tenantId, accountId, personId },
      { tenantId, accountId: otherAccountId, personId },
    ]);
    app = buildApp({
      db,
      auth: new DevelopmentHeaderAuth(false),
      environment: {
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl!,
        COMMERCE_API_HOST: "127.0.0.1",
        COMMERCE_API_PORT: 4000,
        ENABLE_DEV_ADMIN_ROUTES: false,
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.tenantId, tenantId));
    await db.delete(outboxEvents).where(eq(outboxEvents.tenantId, tenantId));
    await db
      .delete(jobRequestStatusHistory)
      .where(eq(jobRequestStatusHistory.tenantId, tenantId));
    await db
      .delete(jobRequestSnapshots)
      .where(eq(jobRequestSnapshots.tenantId, tenantId));
    await db.delete(jobRequestLines).where(eq(jobRequestLines.tenantId, tenantId));
    await db.delete(jobRequests).where(eq(jobRequests.tenantId, tenantId));
    await db.delete(accountPeople).where(eq(accountPeople.tenantId, tenantId));
    await db.delete(stores).where(eq(stores.tenantId, tenantId));
    await db.delete(people).where(eq(people.tenantId, tenantId));
    await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.close();
  });

  it("submits idempotently and hides jobs from another account scope", async () => {
    const idempotencyKey = randomUUID();
    const command = {
      context: { tenantId, accountId, storeId },
      customerPersonId: personId,
      contact: {
        email: "integration@example.test",
        fullName: "Integration Customer",
        phone: "6045550100",
      },
      fulfillment: {
        method: "pickup",
        address: {
          address1: "123 Test Street",
          city: "Vancouver",
          region: "BC",
          postalCode: "V6A 1A1",
          country: "Canada",
        },
      },
      lines: [{ description: "Test shirt", quantity: 12, currency: "CAD" }],
      source: { system: "storefront" },
    };

    const create = () =>
      app.inject({
        method: "POST",
        url: "/v1/job-requests",
        headers: {
          ...headers(),
          [CommerceHeaders.idempotencyKey]: `${idempotencyKey}:create`,
        },
        payload: command,
      });
    const firstCreate = await create();
    const secondCreate = await create();
    expect(firstCreate.statusCode).toBe(201);
    expect(secondCreate.json().id).toBe(firstCreate.json().id);

    const jobRequestId = firstCreate.json().id as string;
    const submit = () =>
      app.inject({
        method: "POST",
        url: `/v1/job-requests/${jobRequestId}/submit`,
        headers: {
          ...headers(),
          [CommerceHeaders.idempotencyKey]: `${idempotencyKey}:submit`,
        },
        payload: {
          context: { tenantId, accountId, storeId },
          source: { system: "storefront" },
        },
      });
    expect((await submit()).json().status).toBe("submitted");
    expect((await submit()).json().status).toBe("submitted");

    const scopedList = await app.inject({
      method: "GET",
      url: "/v1/job-requests",
      headers: headers(),
    });
    expect(scopedList.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: jobRequestId })]),
    );

    const otherList = await app.inject({
      method: "GET",
      url: "/v1/job-requests",
      headers: headers(otherAccountId, otherStoreId),
    });
    expect(otherList.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: jobRequestId })]),
    );
    const hiddenDetail = await app.inject({
      method: "GET",
      url: `/v1/job-requests/${jobRequestId}`,
      headers: headers(otherAccountId, otherStoreId),
    });
    expect(hiddenDetail.statusCode).toBe(404);
  });
});
