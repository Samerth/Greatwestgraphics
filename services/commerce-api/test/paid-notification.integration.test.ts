import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { JobRequestService } from "../src/application/job-request-service.js";
import { dispatchOutboxBatch } from "../src/notifications/outbox-dispatcher.js";
import type { EmailMessage, EmailSender } from "../src/notifications/email.js";
import { createDatabase, type CommerceDatabase } from "../src/db/client.js";
import {
  accounts,
  jobRequests,
  jobRequestStatusHistory,
  outboxEvents,
  people,
  stores,
  tenants,
} from "../src/db/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const DB_TEST_TIMEOUT_MS = 60_000;

/**
 * Collects sent messages instead of contacting SES/Resend — this proves a
 * real email *would* go out, and exactly what it would say, without any risk
 * of actually mailing a fabricated test customer.
 */
class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

// Runs recordPayment and the real outbox dispatcher against a live
// database, proving payment.recorded.v1's notification actually reaches an
// inbox end to end — not just that notificationsForEvent maps it correctly
// (test/notifications.test.ts already covers that unit-level shape).
//
// This started as a test for a bug that turned out not to exist: a
// status_changed.v1 entry for "paid" looked missing from
// notifications/messages.ts, but recordPayment (the only path that ever
// reaches "paid") always overrides its event to
// commerce.job_request.payment.recorded.v1, which already had a full,
// unconditional, already-tested handler. Running this against the real
// database is what caught that — a unit test built from the same wrong
// assumption about which event fires would have passed regardless.
integration(
  "Paid job requests notify the customer end to end via recordPayment",
  () => {
    const tenantId = randomUUID();
    const accountId = randomUUID();
    const storeId = randomUUID();
    const personId = randomUUID();
    const jobRequestId = randomUUID();
    const customerEmail = "paid-notification-owner@example.test";

    let database: ReturnType<typeof createDatabase>;
    let db: CommerceDatabase;

    beforeAll(async () => {
      database = createDatabase(databaseUrl!);
      db = database.db;

      await db.insert(tenants).values({ id: tenantId, name: "Paid notification tenant" });
      await db.insert(accounts).values({
        id: accountId,
        tenantId,
        name: "Paid notification account",
      });
      await db.insert(stores).values({
        id: storeId,
        tenantId,
        accountId,
        name: "Paid notification store",
        slug: `paid-notification-${storeId.slice(0, 8)}`,
      });
      await db.insert(people).values({ id: personId, tenantId, email: customerEmail });
      // Inserted directly in the state recordPayment requires, rather than
      // walked through the full submit → review → approve chain — this test
      // is about the paid transition and its notification, not the earlier
      // lifecycle, which the pre-existing job-request-api integration test
      // already covers.
      await db.insert(jobRequests).values({
        id: jobRequestId,
        tenantId,
        accountId,
        storeId,
        customerPersonId: personId,
        displayId: `GWG-PAID-TEST-${jobRequestId.slice(0, 8)}`,
        status: "awaiting_payment",
      });
    }, DB_TEST_TIMEOUT_MS);

    afterAll(async () => {
      if (!db) return;
      await db.delete(outboxEvents).where(eq(outboxEvents.tenantId, tenantId));
      // job_request_status_history rows reference this job and are never
      // updated or deleted in production — recordPayment writes one on
      // every transition, so it has to go before the job row it points at.
      await db
        .delete(jobRequestStatusHistory)
        .where(eq(jobRequestStatusHistory.tenantId, tenantId));
      await db.delete(jobRequests).where(eq(jobRequests.tenantId, tenantId));
      await db.delete(people).where(eq(people.tenantId, tenantId));
      await db.delete(stores).where(eq(stores.tenantId, tenantId));
      await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await database.close();
    }, DB_TEST_TIMEOUT_MS);

    it(
      "records the payment, queues a real outbox event, and dispatches the confirmation email",
      async () => {
        const service = new JobRequestService(db);

        // 1. The exact call a Stripe webhook (or staff, offline) makes.
        const updated = await service.recordPayment(
          jobRequestId,
          {
            context: { tenantId, accountId, storeId },
            note: "Paid by test card in Stripe Checkout",
            source: { system: "stripe" },
          },
          { type: "system", displayName: "Stripe" },
        );
        expect(updated.status).toBe("paid");

        // 2. The same background job that runs continuously in production —
        // claims real outbox rows and would actually call SES/Resend.
        const sender = new RecordingEmailSender();
        const result = await dispatchOutboxBatch({
          db,
          sender,
          siteBaseUrl: "https://shop.example.test",
          staffEmail: null,
        });

        expect(result.sent).toBeGreaterThanOrEqual(1);
        expect(result.failed).toBe(0);

        const paidEmail = sender.sent.find((message) => message.to === customerEmail);
        expect(paidEmail).toBeDefined();
        expect(paidEmail?.subject).toMatch(/received your payment/i);
        expect(paidEmail?.text).toMatch(/payment is recorded/i);
      },
      DB_TEST_TIMEOUT_MS,
    );
  },
);
