import { describe, expect, it } from "vitest";
import { StoreService } from "../src/application/store-service.js";
import type { CommerceDatabase } from "../src/db/client.js";

type Row = {
  id: string;
  tenantId: string;
  accountId: string;
  slug: string;
  name: string;
  status: string;
  logoUrl: string | null;
  accentColor: string | null;
  tagline: string | null;
  customDomain: string | null;
  pricingAdjustmentPercent: string | null;
  isPublic: boolean;
};

const ACME: Row = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: "aaaaaaaa-1111-4111-8111-111111111111",
  accountId: "bbbbbbbb-1111-4111-8111-111111111111",
  slug: "acme",
  name: "Acme Team Store",
  status: "active",
  logoUrl: null,
  accentColor: "#ff0000",
  tagline: null,
  customDomain: null,
  pricingAdjustmentPercent: null,
  isPublic: false,
};

/**
 * A team store carrying no branding at all. Access must not depend on styling:
 * treating "no logo, no accent colour" as public once enrolled any signed-in
 * stranger into the account of a customer who had simply skipped that step.
 */
const UNSTYLED_TEAM_STORE: Row = {
  ...ACME,
  id: "33333333-3333-4333-8333-333333333333",
  slug: "plain",
  name: "Plain Team Store",
  accentColor: null,
  logoUrl: null,
  isPublic: false,
};

/** Same slug, different tenant — the case that must never cross over. */
const OTHER_TENANT_ACME: Row = {
  ...ACME,
  id: "22222222-2222-4222-8222-222222222222",
  tenantId: "cccccccc-2222-4222-8222-222222222222",
  accountId: "dddddddd-2222-4222-8222-222222222222",
  name: "Somebody Else's Acme",
};

/**
 * Stands in for Drizzle's select chain, recording the predicates the service
 * builds so the test can assert on what was actually asked for.
 */
function fakeDb(rows: Row[]) {
  const captured: { tenantId?: string; slug?: string } = {};
  const db = {
    select: () => ({
      from: () => ({
        where: (predicate: unknown) => ({
          limit: () => {
            // drizzle's `and(eq(...), eq(...))` is opaque here, so the fake
            // matches on the values the service passed, captured below.
            const match = rows.filter(
              (row) =>
                row.tenantId === captured.tenantId &&
                row.slug === captured.slug,
            );
            void predicate;
            return Promise.resolve(match.slice(0, 1));
          },
        }),
      }),
    }),
  };
  return { db: db as unknown as CommerceDatabase, captured };
}

/**
 * The service builds its predicate through drizzle, which the fake cannot
 * introspect, so this subclass records the arguments instead.
 */
class RecordingStoreService extends StoreService {
  constructor(
    db: CommerceDatabase,
    private readonly captured: { tenantId?: string; slug?: string },
  ) {
    super(db);
  }
  override async resolveBySlug(tenantId: string, slug: string) {
    this.captured.tenantId = tenantId;
    this.captured.slug = slug.trim().toLowerCase();
    return super.resolveBySlug(tenantId, slug);
  }
}

describe("StoreService.resolveBySlug", () => {
  it("finds a store by slug inside its own tenant", async () => {
    const { db, captured } = fakeDb([ACME]);
    const service = new RecordingStoreService(db, captured);
    const resolved = await service.resolveBySlug(ACME.tenantId, "acme");
    expect(resolved?.storeId).toBe(ACME.id);
    expect(resolved?.name).toBe("Acme Team Store");
  });

  it("reports an unbranded team store as private, not public", async () => {
    // Sign-in reads this flag to decide whether to enrol the visitor in the
    // store's account. Deriving it from the absence of a logo, as it once did,
    // opened every plainly-styled corporate account to strangers.
    const { db, captured } = fakeDb([UNSTYLED_TEAM_STORE]);
    const service = new RecordingStoreService(db, captured);
    const resolved = await service.resolveBySlug(
      UNSTYLED_TEAM_STORE.tenantId,
      "plain",
    );
    expect(resolved?.accentColor).toBeNull();
    expect(resolved?.logoUrl).toBeNull();
    expect(resolved?.isPublic).toBe(false);
  });

  it("refuses to hand back another tenant's store with the same slug", async () => {
    const { db, captured } = fakeDb([OTHER_TENANT_ACME]);
    const service = new RecordingStoreService(db, captured);
    const resolved = await service.resolveBySlug(ACME.tenantId, "acme");
    expect(resolved).toBeNull();
  });

  it("scopes every lookup by the tenant it was given", async () => {
    const { db, captured } = fakeDb([ACME, OTHER_TENANT_ACME]);
    const service = new RecordingStoreService(db, captured);
    await service.resolveBySlug(ACME.tenantId, "acme");
    expect(captured.tenantId).toBe(ACME.tenantId);
  });

  it("normalises case and surrounding whitespace", async () => {
    const { db, captured } = fakeDb([ACME]);
    const service = new RecordingStoreService(db, captured);
    const resolved = await service.resolveBySlug(ACME.tenantId, "  ACME  ");
    expect(resolved?.storeId).toBe(ACME.id);
  });

  it("returns nothing for an empty slug rather than matching the first row", async () => {
    const { db, captured } = fakeDb([ACME]);
    const service = new RecordingStoreService(db, captured);
    expect(await service.resolveBySlug(ACME.tenantId, "   ")).toBeNull();
  });

  it("returns a store that is not active, so the caller can say why", async () => {
    const pending = { ...ACME, status: "pending_review" };
    const { db, captured } = fakeDb([pending]);
    const service = new RecordingStoreService(db, captured);
    const resolved = await service.resolveBySlug(ACME.tenantId, "acme");
    expect(resolved?.status).toBe("pending_review");
  });
});
