import { describe, expect, it } from "vitest";
import { CodChatOrderLookupService } from "../src/application/codchat-order-lookup-service.js";
import type { CommerceDatabase } from "../src/db/client.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

const job = {
  status: "in_production",
  updatedAt: new Date("2026-09-08T12:00:00.000Z"),
  ownerEmail: "buyer@example.test",
};

/** Same shape as store-host-resolution.test.ts's stub, extended with the
 * innerJoin this service's query adds. */
function stubDatabase(rows: unknown[]) {
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => rows,
          }),
        }),
      }),
    }),
  };
  return db as unknown as CommerceDatabase;
}

describe("CodChatOrderLookupService.lookup", () => {
  it("returns the order for the verified owner's own email", async () => {
    const service = new CodChatOrderLookupService(stubDatabase([job]));
    const result = await service.lookup(
      TENANT_ID,
      "GWG-1001",
      "buyer@example.test",
    );
    expect(result).toEqual({
      orderRef: "GWG-1001",
      status: "In production",
      updatedAt: "2026-09-08T12:00:00.000Z",
    });
  });

  it("matches regardless of email case or surrounding whitespace", async () => {
    const service = new CodChatOrderLookupService(stubDatabase([job]));
    const result = await service.lookup(
      TENANT_ID,
      "GWG-1001",
      "  Buyer@Example.TEST  ",
    );
    expect(result?.status).toBe("In production");
  });

  it("refuses a real order when the email does not match its owner", async () => {
    const service = new CodChatOrderLookupService(stubDatabase([job]));
    const result = await service.lookup(
      TENANT_ID,
      "GWG-1001",
      "someone-else@example.test",
    );
    expect(result).toBeNull();
  });

  it("returns null for an order reference that does not exist", async () => {
    const service = new CodChatOrderLookupService(stubDatabase([]));
    const result = await service.lookup(
      TENANT_ID,
      "GWG-9999",
      "buyer@example.test",
    );
    expect(result).toBeNull();
  });

  it("treats a not-found and a wrong-email result identically", async () => {
    // The route must not let a caller distinguish "no such order" from
    // "wrong email for a real order" — both have to collapse to the same
    // null here so the HTTP layer can return one generic 404 either way.
    const notFound = await new CodChatOrderLookupService(
      stubDatabase([]),
    ).lookup(TENANT_ID, "GWG-9999", "buyer@example.test");
    const wrongEmail = await new CodChatOrderLookupService(
      stubDatabase([job]),
    ).lookup(TENANT_ID, "GWG-1001", "someone-else@example.test");
    expect(notFound).toBe(wrongEmail);
  });

  it("never matches when the job owner has no email on file", async () => {
    const service = new CodChatOrderLookupService(
      stubDatabase([{ ...job, ownerEmail: null }]),
    );
    const result = await service.lookup(
      TENANT_ID,
      "GWG-1001",
      "buyer@example.test",
    );
    expect(result).toBeNull();
  });

  it("falls back to the raw status string for a status the label map does not cover", async () => {
    const service = new CodChatOrderLookupService(
      stubDatabase([{ ...job, status: "some_future_status" }]),
    );
    const result = await service.lookup(
      TENANT_ID,
      "GWG-1001",
      "buyer@example.test",
    );
    expect(result?.status).toBe("some_future_status");
  });
});
