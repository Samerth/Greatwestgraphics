import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Actor } from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import { accountPeople, accountInvites, accounts } from "../db/schema.js";

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

  async acceptInvite(
    token: string,
    personId: string,
    personEmail: string,
    actor: Actor,
  ): Promise<{ accountId: string }> {
    const invite = await this.getInvite(token);
    if (invite.status !== "pending") {
      throw new InviteNotFoundError("This invite has already been used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new InviteExpiredError("This invite has expired.");
    }
    if (invite.email.toLowerCase() !== personEmail.toLowerCase()) {
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

    return { accountId: invite.accountId };
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
