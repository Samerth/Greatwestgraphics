import { describe, expect, it } from "vitest";
import { StoreService } from "../src/application/store-service.js";
import type { CommerceDatabase } from "../src/db/client.js";

const acmeStore = {
  id: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  name: "Acme Merch",
  slug: "acme",
  status: "active",
  logoUrl: null,
  accentColor: null,
  tagline: null,
  customDomain: "shop.acme.test",
  pricingAdjustmentPercent: null,
};

/**
 * Answers each query in turn — `resolveByHost` runs the custom-domain lookup
 * first and the slug lookup second — and counts how many it actually ran. The
 * count is the assertion that matters for an unrecognised host: reaching the
 * slug lookup at all is what used to hand out a store nobody had registered.
 */
function stubDatabase(answers: unknown[][]) {
  let ran = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => answers[ran++] ?? [],
        }),
      }),
    }),
  };
  return { db: db as unknown as CommerceDatabase, queriesRun: () => ran };
}

describe("StoreService.resolveByHost", () => {
  it("resolves a host registered as a store's custom domain", async () => {
    const { db } = stubDatabase([[acmeStore]]);
    const resolved = await new StoreService(db).resolveByHost("shop.acme.test");
    expect(resolved).toMatchObject({
      tenantId: acmeStore.tenantId,
      accountId: acmeStore.accountId,
      storeId: acmeStore.id,
      slug: "acme",
    });
  });

  it("ignores the port and the case of the inbound host", async () => {
    const { db } = stubDatabase([[acmeStore]]);
    const resolved = await new StoreService(db).resolveByHost("Shop.Acme.Test:443");
    expect(resolved?.storeId).toBe(acmeStore.id);
  });

  it("resolves nothing for an unregistered host when no base domain is set", async () => {
    const stub = stubDatabase([[], [acmeStore]]);
    const resolved = await new StoreService(stub.db).resolveByHost(
      "acme.cloudfront.net",
    );
    expect(resolved).toBeNull();
    expect(stub.queriesRun()).toBe(1);
  });

  it("resolves a slug subdomain of the configured base domain", async () => {
    const stub = stubDatabase([[], [acmeStore]]);
    const resolved = await new StoreService(stub.db, "stores.gwg.test").resolveByHost(
      "acme.stores.gwg.test",
    );
    expect(resolved?.storeId).toBe(acmeStore.id);
    expect(stub.queriesRun()).toBe(2);
  });

  it("refuses a slug subdomain of somebody else's domain", async () => {
    const stub = stubDatabase([[], [acmeStore]]);
    const resolved = await new StoreService(stub.db, "stores.gwg.test").resolveByHost(
      "acme.attacker.test",
    );
    expect(resolved).toBeNull();
    expect(stub.queriesRun()).toBe(1);
  });

  it("takes only a single label as a slug, and never the base domain itself", async () => {
    for (const host of ["a.acme.stores.gwg.test", "stores.gwg.test"]) {
      const stub = stubDatabase([[], [acmeStore]]);
      const resolved = await new StoreService(stub.db, "stores.gwg.test").resolveByHost(
        host,
      );
      expect(resolved).toBeNull();
      expect(stub.queriesRun()).toBe(1);
    }
  });

  it("does not read an IP address as a store slug", async () => {
    const stub = stubDatabase([[], [acmeStore]]);
    const resolved = await new StoreService(stub.db, "stores.gwg.test").resolveByHost(
      "35.182.165.8",
    );
    expect(resolved).toBeNull();
    expect(stub.queriesRun()).toBe(1);
  });
});
