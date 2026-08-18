import { eq, and } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { accountPeople, accounts, stores } from "../db/schema.js";
import { slugify } from "../adapters/ss-activewear/client.js";

export class SlugTakenError extends Error {
  readonly code = "SLUG_TAKEN";
}

export class AccountService {
  constructor(private readonly db: CommerceDatabase) {}

  async suggestSlug(tenantId: string, base: string): Promise<string> {
    const root = slugify(base) || "store";
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
      const [existing] = await this.db
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.tenantId, tenantId), eq(stores.slug, candidate)))
        .limit(1);
      if (!existing) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  /**
   * Creates a brand-new corporate account + its first store, owned by the
   * given person. New stores start `pending_review` — a quick staff glance
   * before going live, matching the existing approval-first pattern used
   * for job requests, not a hard gate.
   */
  async createAccountWithStore(
    tenantId: string,
    personId: string,
    input: {
      accountName: string;
      storeName: string;
      slug: string;
      accentColor?: string;
      logoUrl?: string;
      tagline?: string;
    },
    actor: Actor,
  ): Promise<{ accountId: string; storeId: string; slug: string }> {
    const [existingSlug] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.tenantId, tenantId), eq(stores.slug, input.slug)))
      .limit(1);
    if (existingSlug) {
      throw new SlugTakenError(`The slug "${input.slug}" is already in use.`);
    }

    const [account] = await this.db
      .insert(accounts)
      .values({ tenantId, name: input.accountName, createdBy: actor })
      .returning();
    if (!account) throw new Error("Failed to create account");

    const [store] = await this.db
      .insert(stores)
      .values({
        tenantId,
        accountId: account.id,
        name: input.storeName,
        slug: input.slug,
        status: "pending_review",
        accentColor: input.accentColor ?? null,
        logoUrl: input.logoUrl ?? null,
        tagline: input.tagline ?? null,
        createdBy: actor,
      })
      .returning();
    if (!store) throw new Error("Failed to create store");

    await this.db.insert(accountPeople).values({
      tenantId,
      accountId: account.id,
      personId,
      role: "owner",
      createdBy: actor,
    });

    return { accountId: account.id, storeId: store.id, slug: store.slug };
  }

  /**
   * The person's role on an account, or null when they hold no membership.
   * Null rather than a thrown error: a signed-in stranger reading a store they
   * do not belong to is an ordinary state, not a fault.
   */
  async membershipRole(
    tenantId: string,
    accountId: string,
    personId: string,
  ): Promise<string | null> {
    const [membership] = await this.db
      .select({ role: accountPeople.role })
      .from(accountPeople)
      .where(
        and(
          eq(accountPeople.tenantId, tenantId),
          eq(accountPeople.accountId, accountId),
          eq(accountPeople.personId, personId),
        ),
      )
      .limit(1);
    return membership?.role ?? null;
  }

  async listMembershipsForPerson(tenantId: string, personId: string) {
    return this.db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        role: accountPeople.role,
        storeId: stores.id,
        storeName: stores.name,
        storeSlug: stores.slug,
        storeStatus: stores.status,
      })
      .from(accountPeople)
      .innerJoin(accounts, eq(accountPeople.accountId, accounts.id))
      .innerJoin(stores, eq(stores.accountId, accounts.id))
      .where(
        and(eq(accountPeople.tenantId, tenantId), eq(accountPeople.personId, personId)),
      );
  }

  async listPendingStores(tenantId: string) {
    return this.db
      .select()
      .from(stores)
      .where(and(eq(stores.tenantId, tenantId), eq(stores.status, "pending_review")));
  }

  async listAllStores(tenantId: string) {
    return this.db
      .select()
      .from(stores)
      .where(eq(stores.tenantId, tenantId))
      .orderBy(stores.name);
  }

  async setStoreStatus(
    tenantId: string,
    storeId: string,
    status: "active" | "suspended",
  ) {
    const [updated] = await this.db
      .update(stores)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(stores.tenantId, tenantId), eq(stores.id, storeId)))
      .returning();
    return updated;
  }
}
