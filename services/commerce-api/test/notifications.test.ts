import { describe, expect, it, vi } from "vitest";
import {
  backoffSeconds,
  notificationsForEvent,
  type NotificationContext,
} from "../src/notifications/messages.js";
import {
  ResendEmailSender,
  UnconfiguredEmailSender,
} from "../src/notifications/email.js";
import { dispatchOutboxBatch } from "../src/notifications/outbox-dispatcher.js";

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const context: NotificationContext = {
  jobDisplayId: "GWG-1001",
  customerEmail: "buyer@example.test",
  staffEmail: "art@example.test",
  siteBaseUrl: "https://shop.example.test/",
};

describe("notificationsForEvent", () => {
  it("asks the customer to approve a proof staff raised", () => {
    const [message] = notificationsForEvent(
      {
        type: "commerce.job_request.proof.created.v1",
        data: { proofVersion: 2, awaitingDecisionFrom: "customer", note: "Logo centred" },
      },
      JOB_ID,
      context,
    );
    expect(message.to).toBe("buyer@example.test");
    expect(message.subject).toContain("GWG-1001");
    expect(message.subject).toMatch(/ready to approve/i);
    expect(message.text).toContain("Logo centred");
    // The trailing slash on siteBaseUrl must not produce a double slash.
    expect(message.text).toContain(`https://shop.example.test/portal/jobs/${JOB_ID}`);
    expect(message.text).not.toContain("//portal");
  });

  it("tells staff when a customer submits artwork", () => {
    const [message] = notificationsForEvent(
      {
        type: "commerce.job_request.proof.created.v1",
        data: { proofVersion: 1, awaitingDecisionFrom: "staff" },
      },
      JOB_ID,
      context,
    );
    expect(message.to).toBe("art@example.test");
    expect(message.text).toContain(`/admin/jobs/${JOB_ID}`);
  });

  it("sends a decision to the side that did not make it", () => {
    const [toStaff] = notificationsForEvent(
      {
        type: "commerce.job_request.proof.decided.v1",
        data: { proofVersion: 3, decision: "approved", decidedBy: "customer" },
      },
      JOB_ID,
      context,
    );
    expect(toStaff.to).toBe("art@example.test");
    expect(toStaff.subject).toMatch(/customer approved/i);

    const [toCustomer] = notificationsForEvent(
      {
        type: "commerce.job_request.proof.decided.v1",
        data: {
          proofVersion: 3,
          decision: "changes_requested",
          decidedBy: "staff",
          note: "Send a vector file",
        },
      },
      JOB_ID,
      context,
    );
    expect(toCustomer.to).toBe("buyer@example.test");
    expect(toCustomer.subject).toMatch(/need a change/i);
    expect(toCustomer.text).toContain("Send a vector file");
  });

  it("sends nothing when the recipient has no address", () => {
    const noEmails = { ...context, customerEmail: null, staffEmail: null };
    expect(
      notificationsForEvent(
        {
          type: "commerce.job_request.proof.created.v1",
          data: { proofVersion: 1, awaitingDecisionFrom: "customer" },
        },
        JOB_ID,
        noEmails,
      ),
    ).toEqual([]);
  });

  it("ignores events it has no opinion about", () => {
    // Status changes are excluded on purpose: a proof decision already moves
    // the job, so mapping both would send two emails for one action.
    expect(
      notificationsForEvent(
        { type: "commerce.job_request.status_changed.v1", data: {} },
        JOB_ID,
        context,
      ),
    ).toEqual([]);
    expect(notificationsForEvent({}, JOB_ID, context)).toEqual([]);
  });
});

describe("backoffSeconds", () => {
  it("grows with attempts and stops at a ceiling", () => {
    expect(backoffSeconds(1)).toBe(30);
    expect(backoffSeconds(2)).toBe(60);
    expect(backoffSeconds(3)).toBe(120);
    expect(backoffSeconds(50)).toBe(30 * 60);
  });
});

describe("UnconfiguredEmailSender", () => {
  it("throws rather than pretending to send", async () => {
    // Reporting success would let the dispatcher mark events published and
    // lose the notification permanently.
    await expect(
      new UnconfiguredEmailSender().send({
        to: "a@b.test",
        subject: "s",
        text: "t",
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
  });
});

describe("ResendEmailSender", () => {
  it("surfaces the response body when Resend refuses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "domain is not verified",
    });
    await expect(
      new ResendEmailSender("key", "from@test", fetchImpl as unknown as typeof fetch).send({
        to: "a@b.test",
        subject: "s",
        text: "t",
      }),
    ).rejects.toThrow(/403.*domain is not verified/);
  });
});

/** Minimal stand-in for the Drizzle database: returns the claimed batch on the
 * first execute, then records the follow-up statements. */
function fakeDb(rows: unknown[]) {
  const statements: string[] = [];
  let first = true;
  return {
    statements,
    db: {
      execute: vi.fn(async (query: { queryChunks?: unknown[] }) => {
        if (first) {
          first = false;
          return rows;
        }
        statements.push(JSON.stringify(query?.queryChunks ?? query));
        return [];
      }),
    },
  };
}

describe("dispatchOutboxBatch", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    aggregate_id: JOB_ID,
    event_type: "commerce.job_request.proof.created.v1",
    payload: {
      type: "commerce.job_request.proof.created.v1",
      data: { proofVersion: 1, awaitingDecisionFrom: "customer" },
    },
    attempts: 0,
    display_id: "GWG-1001",
    customer_email: "buyer@example.test",
  };

  it("sends a claimed event and marks it published", async () => {
    const { db, statements } = fakeDb([row]);
    const sender = { send: vi.fn().mockResolvedValue(undefined) };

    const result = await dispatchOutboxBatch({
      db: db as never,
      sender,
      siteBaseUrl: "https://shop.example.test",
      staffEmail: "art@example.test",
    });

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(sender.send).toHaveBeenCalledOnce();
    expect(statements.join(" ")).toContain("published_at");
  });

  it("leaves a failed send unpublished so it retries", async () => {
    const { db, statements } = fakeDb([row]);
    const sender = { send: vi.fn().mockRejectedValue(new Error("smtp exploded")) };

    const result = await dispatchOutboxBatch({
      db: db as never,
      sender,
      siteBaseUrl: "https://shop.example.test",
      staffEmail: "art@example.test",
    });

    expect(result).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
    const written = statements.join(" ");
    expect(written).toContain("last_error");
    expect(written).not.toContain("published_at");
  });

  it("retires an event nothing wants to send", async () => {
    // Otherwise the dispatcher re-reads it on every poll forever.
    const { db } = fakeDb([
      { ...row, payload: { type: "commerce.job_request.status_changed.v1", data: {} } },
    ]);
    const sender = { send: vi.fn() };

    const result = await dispatchOutboxBatch({
      db: db as never,
      sender,
      siteBaseUrl: "https://shop.example.test",
      staffEmail: null,
    });

    expect(result).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(sender.send).not.toHaveBeenCalled();
  });
});
