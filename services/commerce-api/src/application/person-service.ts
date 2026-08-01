import { and, eq } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import { accountPeople, externalIdentities, people } from "../db/schema.js";

export class PersonService {
  constructor(private readonly db: CommerceDatabase) {}

  /**
   * Resolves the `people` row for an external identity (e.g. a Cognito
   * user), creating it — and, if this is the first time this email has
   * signed in, the person row too — on first sign-in. Matching an existing
   * person by email lets someone who was invited by email before they ever
   * signed up link up to that same identity once they do.
   *
   * When `isPublicStore` is true, also ensures the person is a member of
   * `accountId`. Without this, a plain retail customer signing up directly
   * on the default storefront — not via an invite or the corporate wizard,
   * both of which already create membership explicitly — would have no
   * `accountPeople` row and couldn't submit a job request. This must stay
   * gated to public/unbranded stores: auto-joining on a branded corporate
   * store would let any Cognito user grant themselves access to that
   * client's account and order history just by signing in on their
   * subdomain. Idempotent either way — a no-op if already a member.
   */
  async findOrCreateByExternalIdentity(
    tenantId: string,
    accountId: string,
    isPublicStore: boolean,
    system: string,
    externalId: string,
    profile: { email: string; name: string },
  ): Promise<{ personId: string }> {
    const [existingLink] = await this.db
      .select({ personId: externalIdentities.personId })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.tenantId, tenantId),
          eq(externalIdentities.system, system),
          eq(externalIdentities.externalId, externalId),
        ),
      )
      .limit(1);

    let personId: string;
    if (existingLink) {
      personId = existingLink.personId;
    } else {
      const [existingPerson] = await this.db
        .select({ id: people.id })
        .from(people)
        .where(
          and(eq(people.tenantId, tenantId), eq(people.email, profile.email)),
        )
        .limit(1);

      personId = existingPerson
        ? existingPerson.id
        : (
            await this.db
              .insert(people)
              .values({
                tenantId,
                email: profile.email,
                displayName: profile.name,
              })
              .returning({ id: people.id })
          )[0]!.id;

      await this.db.insert(externalIdentities).values({
        tenantId,
        personId,
        system,
        externalId,
      });
    }

    if (isPublicStore) {
      await this.db
        .insert(accountPeople)
        .values({ tenantId, accountId, personId, role: "member" })
        .onConflictDoNothing();
    }

    return { personId };
  }
}
