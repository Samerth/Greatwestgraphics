import { eq, and, or, sql, ilike, inArray } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { accountPeople, accounts, people, stores } from "../db/schema.js";
import { slugify } from "../adapters/ss-activewear/client.js";
import { postgresSqlState } from "../db/postgres-error.js";

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

    return this.db.transaction(async (tx) => {
      const [account] = await tx
        .insert(accounts)
        .values({ tenantId, name: input.accountName, createdBy: actor })
        .returning();
      if (!account) throw new Error("Failed to create account");

      let store: typeof stores.$inferSelect | undefined;
      try {
        [store] = await tx
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
      } catch (insertError) {
        // The pre-check above closes the gap for a normal double-click, but
        // two concurrent submissions of the identical slug can both pass it
        // before either has inserted. The unique index is the real guard —
        // translate its violation into the same clean error the pre-check
        // gives everyone else, instead of a raw constraint-violation 500.
        if (postgresSqlState(insertError) === "23505") {
          throw new SlugTakenError(`The slug "${input.slug}" is already in use.`);
        }
        throw insertError;
      }
      if (!store) throw new Error("Failed to create store");

      await tx.insert(accountPeople).values({
        tenantId,
        accountId: account.id,
        personId,
        role: "owner",
        createdBy: actor,
      });

      return { accountId: account.id, storeId: store.id, slug: store.slug };
    });
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
    const personIds = await this.personIdsForIdentity(tenantId, personId);
    await this.attachMissingOwnedStores(tenantId, personId, personIds);
    return this.selectMemberships(tenantId, personIds);
  }

  /**
   * The signed-in person plus any other `people` rows that share their email.
   * A second Cognito user (or a case-different email) used to create a second
   * person, so the store they already opened disappeared from this login.
   */
  private async personIdsForIdentity(
    tenantId: string,
    personId: string,
  ): Promise<string[]> {
    const [person] = await this.db
      .select({ id: people.id, email: people.email })
      .from(people)
      .where(and(eq(people.tenantId, tenantId), eq(people.id, personId)))
      .limit(1);
    if (!person?.email) return [personId];

    const aliases = await this.db
      .select({ id: people.id })
      .from(people)
      .where(
        and(
          eq(people.tenantId, tenantId),
          sql`lower(${people.email}) = ${person.email.toLowerCase()}`,
        ),
      );
    return [...new Set([personId, ...aliases.map((row) => row.id)])];
  }

  /**
   * Re-attach stores this person clearly already owns. Staging had approved
   * stores whose `account_people` row never landed (create is now transactional)
   * or landed on a duplicate person row, so `/start` kept showing the wizard.
   */
  private async attachMissingOwnedStores(
    tenantId: string,
    actingPersonId: string,
    personIds: string[],
  ): Promise<void> {
    const created = await this.db
      .select({
        accountId: stores.accountId,
      })
      .from(stores)
      .where(
        and(
          eq(stores.tenantId, tenantId),
          or(
            ...personIds.map(
              (id) => sql`${stores.createdBy} ->> 'id' = ${id}`,
            ),
          ),
        ),
      );

    const [person] = await this.db
      .select({ displayName: people.displayName })
      .from(people)
      .where(eq(people.id, actingPersonId))
      .limit(1);

    const named =
      person?.displayName && person.displayName.trim().length >= 3
        ? await this.db
            .select({ accountId: stores.accountId })
            .from(stores)
            .where(
              and(
                eq(stores.tenantId, tenantId),
                eq(stores.isPublic, false),
                or(
                  ilike(stores.name, person.displayName.trim()),
                  ilike(stores.name, `${person.displayName.trim()} %`),
                ),
              ),
            )
        : [];

    const accountIds = [
      ...new Set([...created, ...named].map((row) => row.accountId)),
    ];
    if (accountIds.length === 0) return;

    const actor: Actor = { type: "customer", id: actingPersonId };
    for (const accountId of accountIds) {
      await this.db
        .insert(accountPeople)
        .values({
          tenantId,
          accountId,
          personId: actingPersonId,
          role: "owner",
          createdBy: actor,
        })
        .onConflictDoNothing();
    }
  }

  private selectMemberships(tenantId: string, personIds: string[]) {
    return this.db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        role: accountPeople.role,
        storeId: stores.id,
        storeName: stores.name,
        storeSlug: stores.slug,
        storeStatus: stores.status,
        // Lets the caller tell a corporate membership from the one every
        // retail shopper holds on the operator's own shop, which is the
        // difference between "you have a team" and "you bought a t-shirt".
        storeIsPublic: stores.isPublic,
      })
      .from(accountPeople)
      .innerJoin(accounts, eq(accountPeople.accountId, accounts.id))
      .innerJoin(stores, eq(stores.accountId, accounts.id))
      .where(
        and(
          eq(accountPeople.tenantId, tenantId),
          inArray(accountPeople.personId, personIds),
        ),
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
  ): Promise<{
    id: string;
    status: string;
    slug: string;
    name: string;
    accountId: string;
    ownerEmail: string | null;
    ownerName: string | null;
  } | null> {
    const [updated] = await this.db
      .update(stores)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(stores.tenantId, tenantId), eq(stores.id, storeId)))
      .returning({
        id: stores.id,
        status: stores.status,
        slug: stores.slug,
        name: stores.name,
        accountId: stores.accountId,
      });
    if (!updated) return null;

    const [owner] = await this.db
      .select({
        email: people.email,
        name: people.displayName,
      })
      .from(accountPeople)
      .innerJoin(people, eq(people.id, accountPeople.personId))
      .where(
        and(
          eq(accountPeople.tenantId, tenantId),
          eq(accountPeople.accountId, updated.accountId),
          eq(accountPeople.role, "owner"),
        ),
      )
      .limit(1);

    return {
      ...updated,
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.name ?? null,
    };
  }
}
