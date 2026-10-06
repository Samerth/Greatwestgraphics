import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  CatalogService,
  SYNC_RUN_STALE_AFTER_MS,
} from "../src/application/catalog-service.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import { syncRuns, tenants } from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const DB_TEST_TIMEOUT_MS = 60_000;

/**
 * A sync runs inside the API process, so a restart or a deploy during one left
 * its record saying "running" forever, and the admin page greys out a vendor's
 * buttons while any of its runs says "running". One such record, from 26 Aug
 * 2026, was still locking SanMar's stock-and-price refresh on 2 Oct.
 */
integration("Interrupted sync runs are closed instead of locking the page", () => {
  const tenantId = randomUUID();
  const staleId = randomUUID();
  const liveId = randomUUID();
  const doneId = randomUUID();
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  let database: ReturnType<typeof createDatabase>;
  let db: CommerceDatabase;
  let service: CatalogService;

  beforeAll(async () => {
    database = createDatabase(databaseUrl!);
    db = database.db;
    service = new CatalogService(db);
    await db.insert(tenants).values({ id: tenantId, name: "Sync run recovery tenant" });
    await db.insert(syncRuns).values([
      {
        id: staleId,
        tenantId,
        vendor: "sanmar",
        type: "inventory",
        status: "running",
        startedAt: hoursAgo(24 * 37),
        updatedAt: hoursAgo(24 * 37),
      },
      {
        id: liveId,
        tenantId,
        vendor: "sanmar",
        type: "inventory",
        status: "running",
        startedAt: hoursAgo(0.1),
        updatedAt: hoursAgo(0.05),
      },
      {
        id: doneId,
        tenantId,
        vendor: "ss_activewear",
        type: "full",
        status: "completed",
        startedAt: hoursAgo(30),
        updatedAt: hoursAgo(30),
        finishedAt: hoursAgo(29.9),
      },
    ]);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (!db) return;
    await db.delete(syncRuns).where(eq(syncRuns.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.close();
  }, DB_TEST_TIMEOUT_MS);

  it("uses a stale window far longer than any real sync", () => {
    expect(SYNC_RUN_STALE_AFTER_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it(
    "closes a run that stopped reporting, and leaves a live one and a finished one alone",
    async () => {
      const runs = await service.listSyncRuns(tenantId);
      const byId = new Map(runs.map((run) => [run.id, run]));

      const stale = byId.get(staleId)!;
      expect(stale.status).toBe("failed");
      expect(stale.errorSummary).toMatch(/Interrupted/);
      expect(stale.finishedAt).not.toBeNull();

      expect(byId.get(liveId)!.status).toBe("running");
      expect(byId.get(doneId)!.status).toBe("completed");
    },
    DB_TEST_TIMEOUT_MS,
  );

  it(
    "does nothing the second time",
    async () => {
      expect(await service.failInterruptedSyncRuns(tenantId)).toBe(0);
    },
    DB_TEST_TIMEOUT_MS,
  );
});
