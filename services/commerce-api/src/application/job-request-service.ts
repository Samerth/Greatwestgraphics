import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type {
  Actor,
  CreateJobRequest,
  JobRequestDetailResponse,
  JobRequestResponse,
  JobRequestStatus,
  SourceMetadata,
  SubmitJobRequest,
  TransitionJobRequest,
} from "@gwg/contracts";
import type { CommerceDatabase } from "../db/client.js";
import {
  accountPeople,
  idempotencyKeys,
  jobRequestLines,
  jobRequests,
  jobRequestSnapshots,
  jobRequestStatusHistory,
  outboxEvents,
  stores,
} from "../db/schema.js";
import { assertJobRequestTransition } from "../domain/job-request-state.js";

export class ResourceNotFoundError extends Error {
  readonly code = "RESOURCE_NOT_FOUND";
}

export class ScopeMismatchError extends Error {
  readonly code = "SCOPE_MISMATCH";
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
}

export class DataIntegrityError extends Error {
  readonly code = "DATA_INTEGRITY_ERROR";
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toResponse(row: typeof jobRequests.$inferSelect): JobRequestResponse {
  return {
    id: row.id,
    context: {
      tenantId: row.tenantId,
      accountId: row.accountId,
      storeId: row.storeId,
    },
    customerPersonId: row.customerPersonId,
    status: row.status,
    version: row.version,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class JobRequestService {
  constructor(private readonly db: CommerceDatabase) {}

  async create(
    command: CreateJobRequest,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<JobRequestResponse> {
    const hash = requestHash(command);
    const operation = "job_request.create";
    const { tenantId, accountId, storeId } = command.context;

    return this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${tenantId}:${accountId}:${operation}:${idempotencyKey}`}))`,
      );

      const [prior] = await transaction
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.tenantId, tenantId),
            eq(idempotencyKeys.accountId, accountId),
            eq(idempotencyKeys.operation, operation),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .limit(1);

      if (prior) {
        if (prior.requestHash !== hash) {
          throw new IdempotencyConflictError(
            "The idempotency key was already used with a different request",
          );
        }
        const existing = await this.findScoped(
          transaction,
          tenantId,
          accountId,
          prior.resourceId,
        );
        return toResponse(existing);
      }

      const [store] = await transaction
        .select({ id: stores.id })
        .from(stores)
        .where(
          and(
            eq(stores.tenantId, tenantId),
            eq(stores.accountId, accountId),
            eq(stores.id, storeId),
          ),
        )
        .limit(1);
      const [customer] = await transaction
        .select({ id: accountPeople.id })
        .from(accountPeople)
        .where(
          and(
            eq(accountPeople.tenantId, tenantId),
            eq(accountPeople.accountId, accountId),
            eq(accountPeople.personId, command.customerPersonId),
          ),
        )
        .limit(1);

      if (!store || !customer) {
        throw new ScopeMismatchError(
          "Store and customer must belong to the requested tenant and account",
        );
      }

      const [created] = await transaction
        .insert(jobRequests)
        .values({
          tenantId,
          accountId,
          storeId,
          customerPersonId: command.customerPersonId,
          customerNote: command.customerNote,
          status: "draft",
          createdBy: actor,
          source: command.source,
        })
        .returning();

      if (!created) {
        throw new DataIntegrityError("Database did not return the created job request");
      }

      await transaction.insert(jobRequestLines).values(
        command.lines.map((line, position) => ({
          tenantId,
          accountId,
          jobRequestId: created.id,
          position,
          snapshot: line,
        })),
      );
      await transaction.insert(jobRequestSnapshots).values({
        tenantId,
        accountId,
        jobRequestId: created.id,
        version: 1,
        reason: "created",
        snapshot: command,
        createdBy: actor,
        source: command.source,
      });
      await transaction.insert(jobRequestStatusHistory).values({
        tenantId,
        accountId,
        jobRequestId: created.id,
        fromStatus: null,
        toStatus: "draft",
        actor,
        source: command.source,
      });

      const occurredAt = new Date();
      const eventId = randomUUID();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: created.id,
        eventType: "commerce.job_request.created.v1",
        occurredAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.created.v1",
          version: 1,
          aggregateId: created.id,
          tenantId,
          accountId,
          occurredAt: occurredAt.toISOString(),
          actor,
          source: command.source,
          data: { status: "draft", storeId },
        },
      });
      await transaction.insert(idempotencyKeys).values({
        tenantId,
        accountId,
        operation,
        key: idempotencyKey,
        requestHash: hash,
        resourceId: created.id,
      });

      return toResponse(created);
    });
  }

  async submit(
    jobRequestId: string,
    command: SubmitJobRequest,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<JobRequestResponse> {
    return this.transitionWithIdempotency(
      jobRequestId,
      command,
      "submitted",
      idempotencyKey,
      actor,
      "job_request.submit",
    );
  }

  async transition(
    jobRequestId: string,
    command: TransitionJobRequest,
    actor: Actor,
  ): Promise<JobRequestResponse> {
    const { tenantId, accountId } = command.context;
    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
      );
      assertJobRequestTransition(current.status, command.toStatus);
      return this.applyTransition(
        transaction,
        current,
        command.toStatus,
        command.reason,
        actor,
        command.source,
      );
    });
  }

  async get(
    tenantId: string,
    accountId: string,
    jobRequestId: string,
  ): Promise<JobRequestDetailResponse> {
    const row = await this.findScoped(this.db, tenantId, accountId, jobRequestId);
    const [lines, history] = await Promise.all([
      this.db
        .select()
        .from(jobRequestLines)
        .where(
          and(
            eq(jobRequestLines.tenantId, tenantId),
            eq(jobRequestLines.accountId, accountId),
            eq(jobRequestLines.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(asc(jobRequestLines.position)),
      this.db
        .select()
        .from(jobRequestStatusHistory)
        .where(
          and(
            eq(jobRequestStatusHistory.tenantId, tenantId),
            eq(jobRequestStatusHistory.accountId, accountId),
            eq(jobRequestStatusHistory.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(asc(jobRequestStatusHistory.occurredAt)),
    ]);

    return {
      ...toResponse(row),
      lines: lines.map((line) => ({
        id: line.id,
        position: line.position,
        snapshot: line.snapshot,
      })),
      timeline: history.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        actor: entry.actor,
        source: entry.source,
        occurredAt: entry.occurredAt.toISOString(),
      })),
    };
  }

  async list(
    tenantId: string,
    accountId: string,
  ): Promise<JobRequestResponse[]> {
    const rows = await this.db
      .select()
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.accountId, accountId),
        ),
      )
      .orderBy(desc(jobRequests.createdAt));

    return rows.map(toResponse);
  }

  private async transitionWithIdempotency(
    jobRequestId: string,
    command: SubmitJobRequest,
    toStatus: JobRequestStatus,
    idempotencyKey: string,
    actor: Actor,
    operationPrefix: string,
  ): Promise<JobRequestResponse> {
    const hash = requestHash(command);
    const operation = `${operationPrefix}:${jobRequestId}`;
    const { tenantId, accountId } = command.context;

    return this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${tenantId}:${accountId}:${operation}:${idempotencyKey}`}))`,
      );
      const [prior] = await transaction
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.tenantId, tenantId),
            eq(idempotencyKeys.accountId, accountId),
            eq(idempotencyKeys.operation, operation),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .limit(1);

      if (prior) {
        if (prior.requestHash !== hash) {
          throw new IdempotencyConflictError(
            "The idempotency key was already used with a different request",
          );
        }
        return toResponse(
          await this.findScoped(
            transaction,
            tenantId,
            accountId,
            prior.resourceId,
          ),
        );
      }

      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
      );
      assertJobRequestTransition(current.status, toStatus);
      const updated = await this.applyTransition(
        transaction,
        current,
        toStatus,
        undefined,
        actor,
        command.source,
      );
      await transaction.insert(idempotencyKeys).values({
        tenantId,
        accountId,
        operation,
        key: idempotencyKey,
        requestHash: hash,
        resourceId: jobRequestId,
      });
      return updated;
    });
  }

  private async applyTransition(
    transaction: Parameters<
      Parameters<CommerceDatabase["transaction"]>[0]
    >[0],
    current: typeof jobRequests.$inferSelect,
    toStatus: JobRequestStatus,
    reason: string | undefined,
    actor: Actor,
    source: SourceMetadata,
  ): Promise<JobRequestResponse> {
    const occurredAt = new Date();
    const [updated] = await transaction
      .update(jobRequests)
      .set({
        status: toStatus,
        version: current.version + 1,
        submittedAt:
          toStatus === "submitted" ? occurredAt : current.submittedAt,
        updatedAt: occurredAt,
      })
      .where(
        and(
          eq(jobRequests.tenantId, current.tenantId),
          eq(jobRequests.accountId, current.accountId),
          eq(jobRequests.id, current.id),
          eq(jobRequests.version, current.version),
        ),
      )
      .returning();

    if (!updated) {
      throw new DataIntegrityError("Concurrent job request update detected");
    }

    await transaction.insert(jobRequestStatusHistory).values({
      tenantId: current.tenantId,
      accountId: current.accountId,
      jobRequestId: current.id,
      fromStatus: current.status,
      toStatus,
      reason,
      actor,
      source,
      occurredAt,
    });

    if (toStatus === "submitted") {
      const lines = await transaction
        .select()
        .from(jobRequestLines)
        .where(
          and(
            eq(jobRequestLines.tenantId, current.tenantId),
            eq(jobRequestLines.accountId, current.accountId),
            eq(jobRequestLines.jobRequestId, current.id),
          ),
        )
        .orderBy(asc(jobRequestLines.position));
      await transaction.insert(jobRequestSnapshots).values({
        tenantId: current.tenantId,
        accountId: current.accountId,
        jobRequestId: current.id,
        version: updated.version,
        reason: "submitted",
        snapshot: {
          jobRequest: toResponse(updated),
          lines: lines.map((line) => line.snapshot),
        },
        createdBy: actor,
        source,
      });
    }

    const eventType =
      toStatus === "submitted"
        ? "commerce.job_request.submitted.v1"
        : "commerce.job_request.status_changed.v1";
    const eventId = randomUUID();
    await transaction.insert(outboxEvents).values({
      id: eventId,
      tenantId: current.tenantId,
      accountId: current.accountId,
      aggregateType: "job_request",
      aggregateId: current.id,
      eventType,
      occurredAt,
      payload: {
        id: eventId,
        type: eventType,
        version: 1,
        aggregateId: current.id,
        tenantId: current.tenantId,
        accountId: current.accountId,
        occurredAt: occurredAt.toISOString(),
        actor,
        source,
        data: {
          fromStatus: current.status,
          toStatus,
          reason,
          version: updated.version,
        },
      },
    });

    return toResponse(updated);
  }

  private async findScoped(
    executor: Pick<CommerceDatabase, "select">,
    tenantId: string,
    accountId: string,
    jobRequestId: string,
  ): Promise<typeof jobRequests.$inferSelect> {
    const [row] = await executor
      .select()
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.accountId, accountId),
          eq(jobRequests.id, jobRequestId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundError("Job request not found in account scope");
    }
    return row;
  }
}
