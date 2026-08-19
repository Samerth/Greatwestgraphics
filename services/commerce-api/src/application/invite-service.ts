import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { accountPeople, accountInvites, accounts, people, stores } from "../db/schema.js";

export class NotAccountOwnerError extends Error {
  readonly code = "NOT_ACCOUNT_OWNER";
}
export class InviteNotFoundError extends Error {
  readonly code = "INVITE_NOT_FOUND";
}
export class InviteExpiredError extends Error {
  readonly code = "INVITE_EXPIRED";
}
export class InviteEmailMismatchError extends Error {
  readonly code = "INVITE_EMAIL_MISMATCH";
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InviteService {
  constructor(private readonly db: CommerceDatabase) {}

  private async assertOwner(tenantId: string, accountId: string, personId: string) {
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
    if (!membership || membership.role !== "owner") {
      throw new NotAccountOwnerError(
        "Only the account owner can invite teammates.",
      );
    }
  }

  async createInvite(
    tenantId: string,
    accountId: string,
    inviterPersonId: string,
    email: string,
    actor: Actor,
  ): Promise<{ token: string; accountName: string }> {
    await this.assertOwner(tenantId, accountId, inviterPersonId);
    const [account] = await this.db
      .select({ name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.id, accountId)))
      .limit(1);

    const token = randomBytes(24).toString("base64url");
    await this.db.insert(accountInvites).values({
      tenantId,
      accountId,
      email,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedBy: actor,
      createdBy: actor,
    });
    return { token, accountName: account?.name ?? "your team" };
  }

  async getInvite(token: string) {
    const [invite] = await this.db
      .select()
      .from(accountInvites)
      .where(eq(accountInvites.token, token))
      .limit(1);
    if (!invite) throw new InviteNotFoundError("Invite not found");
    return invite;
  }

  /**
   * The invite plus the name of the account it joins, for the page the
   * recipient lands on. Without the name that page could only offer to join
   * "the team", which is not something anyone should accept on trust.
   */
  async getInviteWithAccountName(token: string) {
    const invite = await this.getInvite(token);
    const [account] = await this.db
      .select({ name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, invite.tenantId),
          eq(accounts.id, invite.accountId),
        ),
      )
      .limit(1);
    return { ...invite, accountName: account?.name ?? null };
  }

  /**
   * Joins the accepting person to the invited account.
   *
   * The email is read from the `people` row rather than taken as an argument.
   * It used to be supplied by the caller and compared against the invite, which
   * made the one check that binds an invite to its intended recipient a
   * comparison against a value the caller chose — and `getInvite` hands out
   * that very address, so echoing it back defeated the check and joined the
   * caller to somebody else's account. Deriving it here means holding the token
   * is no longer enough; the signed-in person must actually be the invitee.
   */
  async acceptInvite(
    token: string,
    personId: string,
    actor: Actor,
  ): Promise<{ accountId: string; storeSlug: string | null; storeName: string | null }> {
    const invite = await this.getInvite(token);
    if (invite.status !== "pending") {
      throw new InviteNotFoundError("This invite has already been used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new InviteExpiredError("This invite has expired.");
    }

    const [person] = await this.db
      .select({ email: people.email })
      .from(people)
      .where(and(eq(people.tenantId, invite.tenantId), eq(people.id, personId)))
      .limit(1);
    // A missing row, or one with no address on file, means we cannot establish
    // who is accepting, so refuse rather than fall through to the insert.
    if (!person?.email || person.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new InviteEmailMismatchError(
        "This invite was sent to a different email address.",
      );
    }

    const [existing] = await this.db
      .select({ id: accountPeople.id })
      .from(accountPeople)
      .where(
        and(
          eq(accountPeople.tenantId, invite.tenantId),
          eq(accountPeople.accountId, invite.accountId),
          eq(accountPeople.personId, personId),
        ),
      )
      .limit(1);
    if (!existing) {
      await this.db.insert(accountPeople).values({
        tenantId: invite.tenantId,
        accountId: invite.accountId,
        personId,
        role: invite.role,
        createdBy: actor,
      });
    }

    await this.db
      .update(accountInvites)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(accountInvites.id, invite.id));

    const [store] = await this.db
      .select({ slug: stores.slug, name: stores.name })
      .from(stores)
      .where(
        and(
          eq(stores.tenantId, invite.tenantId),
          eq(stores.accountId, invite.accountId),
        ),
      )
      .limit(1);

    return {
      accountId: invite.accountId,
      storeSlug: store?.slug ?? null,
      storeName: store?.name ?? null,
    };
  }

  async listForAccount(tenantId: string, accountId: string, requesterPersonId: string) {
    await this.assertOwner(tenantId, accountId, requesterPersonId);
    return this.db
      .select()
      .from(accountInvites)
      .where(
        and(
          eq(accountInvites.tenantId, tenantId),
          eq(accountInvites.accountId, accountId),
        ),
      );
  }
}
