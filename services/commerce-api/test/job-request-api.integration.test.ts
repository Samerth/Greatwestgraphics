import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { CommerceHeaders } from "@gwg/contracts";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import {
  accountPeople,
  accounts,
  finalQuotes,
  idempotencyKeys,
  jobRequestLines,
  jobRequests,
  jobRequestSnapshots,
  jobRequestStatusHistory,
  outboxEvents,
  paymentObligations,
  people,
  stores,
  tenants,
} from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

// Each case is a handful of serialized round trips, and TEST_DATABASE_URL is
// often a managed instance a region away rather than a local container. Vitest's
// 5s default then fails on latency alone and says nothing about the code.
const DB_TEST_TIMEOUT_MS = 60_000;

integration("job request API integration", () => {
  const tenantId = randomUUID();
  const accountId = randomUUID();
  const otherAccountId = randomUUID();
  const storeId = randomUUID();
  const otherStoreId = randomUUID();
  const personId = randomUUID();
  // A second customer in the *same* account, which is what the public
  // storefront produces: every retail shopper who signs in is enrolled into one
  // shared account, so account scope alone does not separate them.
  const otherPersonId = randomUUID();
  let database: ReturnType<typeof createDatabase>;
  let db: CommerceDatabase;
  let app: FastifyInstance;

  const headers = (
    account = accountId,
    store = storeId,
    actor = personId,
  ) => ({
    [CommerceHeaders.tenantId]: tenantId,
    [CommerceHeaders.accountId]: account,
    [CommerceHeaders.storeId]: store,
    [CommerceHeaders.actorId]: actor,
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
    await db.insert(people).values([
      { id: personId, tenantId, email: "integration@example.test" },
      { id: otherPersonId, tenantId, email: "integration-other@example.test" },
    ]);
    await db.insert(accountPeople).values([
      { tenantId, accountId, personId },
      { tenantId, accountId: otherAccountId, personId },
      { tenantId, accountId, personId: otherPersonId },
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
  }, DB_TEST_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.tenantId, tenantId));
    await db.delete(outboxEvents).where(eq(outboxEvents.tenantId, tenantId));
    await db
      .delete(paymentObligations)
      .where(eq(paymentObligations.tenantId, tenantId));
    await db.delete(finalQuotes).where(eq(finalQuotes.tenantId, tenantId));
    await db
      .delete(jobRequestStatusHistory)
      .where(eq(jobRequestStatusHistory.tenantId, tenantId));
    // `job_request_lines` and `job_request_snapshots` carry triggers that reject
    // UPDATE and DELETE, because a submission snapshot is evidence of what the
    // customer agreed to. That is right in production and fatal for a test that
    // has to leave the database as it found it, so the triggers are lifted for
    // this session only — DISABLE TRIGGER is transaction-scoped to this
    // connection and never visible to the running service.
    await db.execute(
      sql`alter table job_request_snapshots disable trigger job_request_snapshots_immutable`,
    );
    await db.execute(
      sql`alter table job_request_lines disable trigger job_request_lines_immutable`,
    );
    try {
      await db
        .delete(jobRequestSnapshots)
        .where(eq(jobRequestSnapshots.tenantId, tenantId));
      await db.delete(jobRequestLines).where(eq(jobRequestLines.tenantId, tenantId));
    } finally {
      await db.execute(
        sql`alter table job_request_lines enable trigger job_request_lines_immutable`,
      );
      await db.execute(
        sql`alter table job_request_snapshots enable trigger job_request_snapshots_immutable`,
      );
    }
    await db.delete(jobRequests).where(eq(jobRequests.tenantId, tenantId));
    await db.delete(accountPeople).where(eq(accountPeople.tenantId, tenantId));
    await db.delete(stores).where(eq(stores.tenantId, tenantId));
    await db.delete(people).where(eq(people.tenantId, tenantId));
    await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.close();
  }, DB_TEST_TIMEOUT_MS);

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

    const detail = await app.inject({
      method: "GET",
      url: `/v1/job-requests/${jobRequestId}`,
      headers: headers(),
    });
    expect(detail.json()).toEqual(
      expect.objectContaining({
        contact: command.contact,
        fulfillment: command.fulfillment,
      }),
    );

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
  }, DB_TEST_TIMEOUT_MS);

  it("lets the owning customer accept only the latest final quote", async () => {
    const idempotencyKey = randomUUID();
    const created = await app.inject({
      method: "POST",
      url: "/v1/job-requests",
      headers: {
        ...headers(),
        [CommerceHeaders.idempotencyKey]: `${idempotencyKey}:create`,
      },
      payload: {
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
        lines: [{ description: "Quoted shirt", quantity: 12, currency: "CAD" }],
        source: { system: "storefront" },
      },
    });
    const jobRequestId = created.json().id as string;
    await db
      .update(jobRequests)
      .set({ status: "approved" })
      .where(eq(jobRequests.id, jobRequestId));
    const [oldQuote, quote] = await db
      .insert(finalQuotes)
      .values([
        {
          tenantId,
          accountId,
          jobRequestId,
          version: 1,
          amountMinor: 9_999,
          currency: "CAD",
          note: "Superseded amount.",
          createdBy: { type: "staff", id: randomUUID() },
          source: { system: "commerce_api" },
        },
        {
          tenantId,
          accountId,
          jobRequestId,
          version: 2,
          amountMinor: 12_345,
          currency: "CAD",
          note: "Includes decoration and setup.",
          createdBy: { type: "staff", id: randomUUID() },
          source: { system: "commerce_api" },
        },
      ])
      .returning();
    expect(quote).toBeDefined();
    const [obligation] = await db
      .insert(paymentObligations)
      .values({
        tenantId,
        accountId,
        jobRequestId,
        finalQuoteId: quote!.id,
        amountMinor: quote!.amountMinor,
        currency: quote!.currency,
        status: "pending_acceptance",
        createdBy: { type: "staff", id: randomUUID() },
        source: { system: "commerce_api" },
      })
      .returning();

    const accept = (quoteId = quote!.id) =>
      app.inject({
        method: "POST",
        url: `/v1/job-requests/${jobRequestId}/final-quotes/${quoteId}/accept`,
        headers: headers(),
        payload: {
          context: { tenantId, accountId, storeId },
          source: { system: "storefront" },
        },
      });
    expect((await accept(oldQuote!.id)).statusCode).toBe(409);
    const first = await accept();
    const second = await accept();
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual(
      expect.objectContaining({
        id: quote!.id,
        amountMinor: 12_345,
        note: "Includes decoration and setup.",
        acceptedAt: expect.any(String),
      }),
    );
    expect(second.json().acceptedAt).toBe(first.json().acceptedAt);

    const [updatedJob] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, jobRequestId))
      .limit(1);
    expect(updatedJob).toEqual(
      expect.objectContaining({
        status: "awaiting_payment",
        finalQuoteAmountMinor: 12_345,
      }),
    );
    const [updatedObligation] = await db
      .select()
      .from(paymentObligations)
      .where(eq(paymentObligations.id, obligation!.id))
      .limit(1);
    expect(updatedObligation?.status).toBe("ready");

    const otherCustomer = await app.inject({
      method: "POST",
      url: `/v1/job-requests/${jobRequestId}/final-quotes/${quote!.id}/accept`,
      headers: headers(accountId, storeId, otherPersonId),
      payload: {
        context: { tenantId, accountId, storeId },
        source: { system: "storefront" },
      },
    });
    expect(otherCustomer.statusCode).toBe(404);
  }, DB_TEST_TIMEOUT_MS);

  it("hides one customer's job from another customer in the same account", async () => {
    // The regression this covers: the public storefront enrols every retail
    // customer into a single shared account, so a list scoped only to the
    // account handed each shopper everyone else's contact details, shipping
    // address, roster and proofs.
    const idempotencyKey = randomUUID();
    const created = await app.inject({
      method: "POST",
      url: "/v1/job-requests",
      headers: {
        ...headers(),
        [CommerceHeaders.idempotencyKey]: `${idempotencyKey}:create`,
      },
      payload: {
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
            address1: "123 Private Street",
            city: "Vancouver",
            region: "BC",
            postalCode: "V6A 1A1",
            country: "Canada",
          },
        },
        lines: [{ description: "Private order", quantity: 5, currency: "CAD" }],
        source: { system: "storefront" },
      },
    });
    expect(created.statusCode).toBe(201);
    const jobRequestId = created.json().id as string;

    const ownerList = await app.inject({
      method: "GET",
      url: "/v1/job-requests",
      headers: headers(),
    });
    expect(ownerList.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: jobRequestId })]),
    );

    const neighbourList = await app.inject({
      method: "GET",
      url: "/v1/job-requests",
      headers: headers(accountId, storeId, otherPersonId),
    });
    expect(neighbourList.statusCode).toBe(200);
    expect(neighbourList.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: jobRequestId })]),
    );

    const neighbourDetail = await app.inject({
      method: "GET",
      url: `/v1/job-requests/${jobRequestId}`,
      headers: headers(accountId, storeId, otherPersonId),
    });
    expect(neighbourDetail.statusCode).toBe(404);
  }, DB_TEST_TIMEOUT_MS);

  it("refuses customer job reads with no identified customer", async () => {
    const anonymous = await app.inject({
      method: "GET",
      url: "/v1/job-requests",
      headers: {
        [CommerceHeaders.tenantId]: tenantId,
        [CommerceHeaders.accountId]: accountId,
        [CommerceHeaders.storeId]: storeId,
      },
    });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json().error.code).toBe("UNAUTHORIZED");
  }, DB_TEST_TIMEOUT_MS);

  // Reads were narrowed to the signed-in person but the submit transition was
  // not, so a neighbour in the shared public account could still drive someone
  // else's draft to `submitted` and read the job back out of the response.
  it("refuses to submit another customer's draft", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/job-requests",
      headers: {
        ...headers(),
        [CommerceHeaders.idempotencyKey]: `${randomUUID()}:create`,
      },
      payload: {
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
            address1: "123 Private Street",
            city: "Vancouver",
            region: "BC",
            postalCode: "V6A 1A1",
            country: "Canada",
          },
        },
        lines: [{ description: "Draft order", quantity: 3, currency: "CAD" }],
        source: { system: "storefront" },
      },
    });
    expect(created.statusCode).toBe(201);
    const jobRequestId = created.json().id as string;

    const submitPayload = {
      context: { tenantId, accountId, storeId },
      source: { system: "storefront" },
    };

    const neighbour = await app.inject({
      method: "POST",
      url: `/v1/job-requests/${jobRequestId}/submit`,
      headers: {
        ...headers(accountId, storeId, otherPersonId),
        [CommerceHeaders.idempotencyKey]: `${randomUUID()}:submit`,
      },
      payload: submitPayload,
    });
    expect(neighbour.statusCode).toBe(404);

    // The draft is untouched, so the owner can still submit it themselves.
    const owner = await app.inject({
      method: "POST",
      url: `/v1/job-requests/${jobRequestId}/submit`,
      headers: {
        ...headers(),
        [CommerceHeaders.idempotencyKey]: `${randomUUID()}:submit`,
      },
      payload: submitPayload,
    });
    expect(owner.statusCode).toBe(200);
    expect(owner.json().status).toBe("submitted");
  }, DB_TEST_TIMEOUT_MS);

  it("refuses to submit a job request with no identified customer", async () => {
    const anonymous = await app.inject({
      method: "POST",
      url: `/v1/job-requests/${randomUUID()}/submit`,
      headers: {
        [CommerceHeaders.tenantId]: tenantId,
        [CommerceHeaders.accountId]: accountId,
        [CommerceHeaders.storeId]: storeId,
        [CommerceHeaders.idempotencyKey]: `${randomUUID()}:submit`,
      },
      payload: {
        context: { tenantId, accountId, storeId },
        source: { system: "storefront" },
      },
    });
    expect(anonymous.statusCode).toBe(403);
    expect(anonymous.json().error.code).toBe("SCOPE_MISMATCH");
  }, DB_TEST_TIMEOUT_MS);
});
