import type {
  AcceptFinalQuote,
  Actor,
  CommerceEventType,
  CreateFinalQuote,
  CreateJobRequest,
  CreateProofVersion,
  DecideProof,
  FinalQuoteResponse,
  InventoryCheck,
  InvoiceRequestResponse,
  IssueInvoice,
  JobRequestDetailResponse,
  JobRequestLineInput,
  JobRequestResponse,
  JobRequestStatus,
  ProofVersionResponse,
  RecordPayment,
  RequestInvoice,
  RespondToChanges,
  SourceMetadata,
  SubmitJobRequest,
  TransitionJobRequest,
} from "@gwg/contracts";
import {
  CreateJobRequestSchema,
  PricingConfigV2Schema,
  QuoteInputSchema,
  QuoteInputV2Schema,
} from "@gwg/contracts";
import { calculateQuote, calculateQuoteV2 } from "@gwg/pricing";
import { applyStorePricingAdjustment } from "./pricing-config-service.js";
import { applyStorePricingAdjustmentV2 } from "./pricing-config-v2-service.js";
import type { CommerceDatabase } from "../db/client.js";
import {
  accountPeople,
  finalQuotes,
  idempotencyKeys,
  jobRequestLines,
  jobRequests,
  jobRequestSnapshots,
  jobRequestStatusHistory,
  outboxEvents,
  paymentObligations,
  people,
  pricingConfigs,
  proofVersions,
  ssProducts,
  ssVariants,
  stores,
} from "../db/schema.js";
import { assertJobRequestTransition } from "../domain/job-request-state.js";
import { requireCustomerScope } from "../domain/customer-scope.js";
import {
  assertProofDecidable,
  audienceForActor,
  defaultAudienceForAuthor,
  statusForProofDecision,
} from "../domain/proof-decision.js";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { PricingConfigSchema } from "@gwg/contracts";
import { postgresSqlState } from "../db/postgres-error.js";

/** Columns the inbox / portal list actually return. Selecting the full
 * `jobRequests` table also pulled CRM fields (`last_crm_sync_at`) that 0008
 * never applied on staging, which took the whole list down with 42703. */
const jobListColumns = {
  id: jobRequests.id,
  tenantId: jobRequests.tenantId,
  accountId: jobRequests.accountId,
  storeId: jobRequests.storeId,
  customerPersonId: jobRequests.customerPersonId,
  displayId: jobRequests.displayId,
  status: jobRequests.status,
  version: jobRequests.version,
  submittedAt: jobRequests.submittedAt,
  createdAt: jobRequests.createdAt,
  updatedAt: jobRequests.updatedAt,
};

type JobListRow = {
  id: string;
  tenantId: string;
  accountId: string;
  storeId: string;
  customerPersonId: string;
  displayId: string;
  status: (typeof jobRequests.$inferSelect)["status"];
  version: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ResourceNotFoundError extends Error {
  readonly code = "RESOURCE_NOT_FOUND";
}

export class ScopeMismatchError extends Error {
  readonly code = "SCOPE_MISMATCH";
}

/**
 * The caller is signed in, and the store is real, but they do not belong to
 * the account that owns it.
 *
 * Separate from `ScopeMismatchError` because it is the one failure here a
 * customer can actually be in the middle of, and it has a remedy: ask the
 * store's owner for an invitation. Reported as itself, the storefront can say
 * that. Folded into a generic scope mismatch, a member of the public who
 * followed a colleague's link reached the end of designing a garment and was
 * told their store and customer must belong to the requested tenant.
 */
export class NotAStoreMemberError extends Error {
  readonly code = "NOT_A_STORE_MEMBER";
}

export class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
}

export class DataIntegrityError extends Error {
  readonly code = "DATA_INTEGRITY_ERROR";
}

export class QuoteAcceptanceError extends Error {
  readonly code = "QUOTE_ACCEPTANCE_ERROR";
}

export class CustomerActionError extends Error {
  readonly code = "CUSTOMER_ACTION_ERROR";
}

export class JobActionError extends Error {
  readonly code = "JOB_ACTION_ERROR";
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type PublishedConfigRow = { version: number; config: unknown };

/**
 * Re-prices a submitted line against whatever is published now, so a stale
 * cart can never lock in an old price. A line is priced with the engine that
 * matches its own snapshot: v2 lines need a published v2 config, v1 lines a
 * v1 one. Without a matching config the line is left as the customer saw it.
 *
 * `storePricingAdjustmentPercent` mirrors what the storefront-facing
 * `/pricing-config/published` and `/pricing/v2/published` endpoints already
 * apply before the customer ever sees a number. Without it here, a job
 * request's authoritative price silently reverts to full tenant pricing the
 * moment it's actually created — the discount shown while building the quote
 * would not be the discount that gets locked in.
 */
function repriceLine(
  line: JobRequestLineInput,
  published: { v1: PublishedConfigRow | null; v2: PublishedConfigRow | null },
  storePricingAdjustmentPercent: number | null,
): JobRequestLineInput {
  const snapshot = line.configuration?.pricing;
  if (!snapshot) {
    // No snapshot means this estimate came from the browser cart and was never
    // recomputed here. Mark it so staff don't read it as an engine number.
    return {
      ...line,
      configuration: { ...line.configuration, pricingUnverified: true },
    };
  }


  if ("schemaVersion" in snapshot && snapshot.schemaVersion === 2) {
    if (!published.v2) return line;
    const config = applyStorePricingAdjustmentV2(
      PricingConfigV2Schema.parse(published.v2.config),
      storePricingAdjustmentPercent,
    );
    const input = QuoteInputV2Schema.parse(snapshot.input);
    const breakdown = calculateQuoteV2(input, config);
    const quantity = breakdown.totalQuantity;
    return {
      ...line,
      quantity,
      unitPriceEstimateMinor: Math.round(
        breakdown.totals.totalMinor / Math.max(1, quantity),
      ),
      currency: "CAD",
      configuration: {
        ...line.configuration,
        pricing: {
          schemaVersion: 2,
          input,
          breakdown,
          pricingConfigVersion: published.v2.version,
        },
      },
    };
  }

  if (!published.v1) return line;
  const config = applyStorePricingAdjustment(
    PricingConfigSchema.parse(published.v1.config),
    storePricingAdjustmentPercent,
  );
  const input = QuoteInputSchema.parse(snapshot.input);
  const breakdown = calculateQuote(input, config);
  return {
    ...line,
    quantity: input.quantity,
    unitPriceEstimateMinor: breakdown.perPieceMinor,
    currency: "CAD",
    configuration: {
      ...line.configuration,
      pricing: {
        input,
        breakdown,
        pricingConfigVersion: published.v1.version,
      },
    },
  };
}

function toResponse(row: JobListRow): JobRequestResponse {
  return {
    id: row.id,
    displayId: row.displayId,
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

async function nextDisplayId(
  transaction: Parameters<
    Parameters<CommerceDatabase["transaction"]>[0]
  >[0],
  tenantId: string,
): Promise<string> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`job_display_id:${tenantId}`}))`,
  );
  const rows = (await transaction.execute(sql`
    select coalesce(
      max(nullif(substring(display_id from 'GWG-([0-9]+)'), '')::int),
      1000
    ) + 1 as next
    from job_requests
    where tenant_id = ${tenantId}
  `)) as unknown as Array<{ next: number | string }>;
  const next = Number(rows[0]?.next ?? 1001);
  return `GWG-${String(next).padStart(4, "0")}`;
}

function toFinalQuoteResponse(
  row: typeof finalQuotes.$inferSelect,
): FinalQuoteResponse {
  return {
    id: row.id,
    jobRequestId: row.jobRequestId,
    version: row.version,
    amountMinor: row.amountMinor,
    currency: row.currency,
    note: row.note ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProofResponse(
  row: typeof proofVersions.$inferSelect,
): ProofVersionResponse {
  const decision =
    row.decision === "approved" ||
    row.decision === "changes_requested" ||
    row.decision === "pending"
      ? row.decision
      : null;
  const awaiting =
    row.awaitingDecisionFrom === "customer" || row.awaitingDecisionFrom === "staff"
      ? row.awaitingDecisionFrom
      : null;
  return {
    id: row.id,
    jobRequestId: row.jobRequestId,
    version: row.version,
    storageKey: row.storageKey,
    decision,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy ?? null,
    decisionNote: row.decisionNote ?? null,
    awaitingDecisionFrom: awaiting,
    note: row.note ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
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
        .select({
          id: stores.id,
          pricingAdjustmentPercent: stores.pricingAdjustmentPercent,
        })
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

      if (!store) {
        throw new ScopeMismatchError(
          "Store and customer must belong to the requested tenant and account",
        );
      }
      if (!customer) {
        throw new NotAStoreMemberError(
          "You are signed in, but you are not a member of this store yet. Ask the store's owner to invite you.",
        );
      }

      // Both schema versions can be published at once during the migration,
      // so fetch each and let every line pick the one its snapshot needs.
      const publishedPricing = await transaction
        .select()
        .from(pricingConfigs)
        .where(
          and(
            eq(pricingConfigs.tenantId, tenantId),
            eq(pricingConfigs.status, "published"),
          ),
        );

      const published = {
        v1: publishedPricing.find((row) => row.schemaVersion === 1) ?? null,
        v2: publishedPricing.find((row) => row.schemaVersion === 2) ?? null,
      };

      const storeAdjustment = store.pricingAdjustmentPercent
        ? Number(store.pricingAdjustmentPercent)
        : null;
      const pricedLines = command.lines.map((line) =>
        repriceLine(line, published, storeAdjustment),
      );

      const displayId = await nextDisplayId(transaction, tenantId);
      const [created] = await transaction
        .insert(jobRequests)
        .values({
          tenantId,
          accountId,
          storeId,
          customerPersonId: command.customerPersonId,
          displayId,
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
        pricedLines.map((line, position) => ({
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
        snapshot: { ...command, lines: pricedLines },
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

  /**
   * Moves a draft the customer owns to `submitted`.
   *
   * The person filter is derived from the actor rather than taken as an
   * argument, so a caller cannot point this at a stranger's draft by
   * forgetting to pass an id. Without it, tenant plus account matched every
   * retail shopper: any signed-in customer could submit somebody else's draft
   * and read the job back out of the response.
   */
  async submit(
    jobRequestId: string,
    command: SubmitJobRequest,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<JobRequestResponse> {
    const customerPersonId = requireCustomerScope(
      actor,
      () =>
        new ScopeMismatchError(
          "Submitting a job request requires an identified customer",
        ),
    );
    return this.transitionWithIdempotency(
      jobRequestId,
      command,
      "submitted",
      idempotencyKey,
      actor,
      "job_request.submit",
      customerPersonId,
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
        undefined,
        command.notifyCustomer,
      );
    });
  }

  async get(
    tenantId: string,
    accountId: string,
    jobRequestId: string,
    customerPersonId?: string,
  ): Promise<JobRequestDetailResponse> {
    const row = await this.findScoped(
      this.db,
      tenantId,
      accountId,
      jobRequestId,
      customerPersonId,
    );
    const [lines, history, quotes, proofs, snapshots, obligations] =
      await Promise.all([
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
      this.db
        .select()
        .from(finalQuotes)
        .where(
          and(
            eq(finalQuotes.tenantId, tenantId),
            eq(finalQuotes.accountId, accountId),
            eq(finalQuotes.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(asc(finalQuotes.version)),
      this.db
        .select()
        .from(proofVersions)
        .where(
          and(
            eq(proofVersions.tenantId, tenantId),
            eq(proofVersions.accountId, accountId),
            eq(proofVersions.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(asc(proofVersions.version)),
      this.db
        .select({ snapshot: jobRequestSnapshots.snapshot })
        .from(jobRequestSnapshots)
        .where(
          and(
            eq(jobRequestSnapshots.tenantId, tenantId),
            eq(jobRequestSnapshots.accountId, accountId),
            eq(jobRequestSnapshots.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(asc(jobRequestSnapshots.version))
        .limit(1),
      this.db
        .select()
        .from(paymentObligations)
        .where(
          and(
            eq(paymentObligations.tenantId, tenantId),
            eq(paymentObligations.accountId, accountId),
            eq(paymentObligations.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(desc(paymentObligations.updatedAt)),
    ]);
    const createdSnapshot = CreateJobRequestSchema.safeParse(
      snapshots[0]?.snapshot,
    );
    const latestQuote = quotes[quotes.length - 1];
    const invoiceObligation = latestQuote
      ? obligations.find((row) => row.finalQuoteId === latestQuote.id)
      : undefined;

    const mappedLines = lines.map((line) => ({
      id: line.id,
      position: line.position,
      snapshot: line.snapshot,
    }));

    return {
      ...toResponse(row),
      customerNote: row.customerNote ?? null,
      contact: createdSnapshot.success ? createdSnapshot.data.contact : null,
      fulfillment: createdSnapshot.success
        ? createdSnapshot.data.fulfillment
        : null,
      invoiceRequestedAt:
        invoiceObligation?.status === "invoice_requested"
          ? invoiceObligation.updatedAt.toISOString()
          : null,
      inventory: await this.checkInventory(tenantId, mappedLines),
      lines: mappedLines,
      timeline: history.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        actor: entry.actor,
        source: entry.source,
        occurredAt: entry.occurredAt.toISOString(),
      })),
      finalQuotes: quotes.map(toFinalQuoteResponse),
      proofs: proofs.map(toProofResponse),
    };
  }

  async createFinalQuote(
    jobRequestId: string,
    command: CreateFinalQuote,
    actor: Actor,
  ): Promise<FinalQuoteResponse> {
    const { tenantId, accountId } = command.context;
    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
      );
      const [latest] = await transaction
        .select({ version: finalQuotes.version })
        .from(finalQuotes)
        .where(
          and(
            eq(finalQuotes.tenantId, tenantId),
            eq(finalQuotes.accountId, accountId),
            eq(finalQuotes.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(desc(finalQuotes.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      const [created] = await transaction
        .insert(finalQuotes)
        .values({
          tenantId,
          accountId,
          jobRequestId,
          version,
          amountMinor: command.amountMinor,
          currency: command.currency,
          note: command.note,
          createdBy: actor,
          source: command.source,
        })
        .returning();
      if (!created) {
        throw new DataIntegrityError("Failed to create final quote");
      }

      await transaction.insert(paymentObligations).values({
        tenantId,
        accountId,
        jobRequestId,
        finalQuoteId: created.id,
        amountMinor: command.amountMinor,
        currency: command.currency,
        status: "pending_acceptance",
        createdBy: actor,
        source: command.source,
      });

      const eventId = randomUUID();
      const occurredAt = new Date();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: jobRequestId,
        eventType: "commerce.job_request.final_quote.created.v1",
        occurredAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.final_quote.created.v1",
          version: 1,
          aggregateId: jobRequestId,
          tenantId,
          accountId,
          occurredAt: occurredAt.toISOString(),
          actor,
          source: command.source,
          data: {
            finalQuoteId: created.id,
            amountMinor: command.amountMinor,
            currency: command.currency,
            quoteVersion: version,
            note: command.note,
          },
        },
      });

      if (command.markAwaitingPayment) {
        if (current.status === "under_review") {
          await this.applyTransition(
            transaction,
            current,
            "approved",
            command.note ?? "Approved with final quote",
            actor,
            command.source,
          );
        }
      }

      return toFinalQuoteResponse(created);
    });
  }

  /**
   * Records the customer's agreement to the latest final quote.
   *
   * Older versions cannot be accepted once staff issue a replacement, and the
   * timestamp update is conditional so a double click or retry is idempotent.
   * A private-store owner may accept for a teammate because the route passes
   * the same whole-account visibility used by their portal; retail customers
   * always arrive with their own person filter.
   */
  async acceptFinalQuote(
    jobRequestId: string,
    finalQuoteId: string,
    command: AcceptFinalQuote,
    actor: Actor,
    customerPersonId?: string,
  ): Promise<FinalQuoteResponse> {
    const { tenantId, accountId } = command.context;
    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
        customerPersonId,
      );
      if (actor.type !== "customer" || !actor.id) {
        throw new ScopeMismatchError(
          "Accepting a quote requires an identified customer",
        );
      }
      if (
        current.status !== "approved" &&
        current.status !== "awaiting_payment"
      ) {
        throw new QuoteAcceptanceError(
          "The final quote can be accepted after design approval.",
        );
      }

      const [latest] = await transaction
        .select()
        .from(finalQuotes)
        .where(
          and(
            eq(finalQuotes.tenantId, tenantId),
            eq(finalQuotes.accountId, accountId),
            eq(finalQuotes.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(desc(finalQuotes.version))
        .limit(1);
      if (!latest) {
        throw new ResourceNotFoundError("Final quote not found");
      }
      if (latest.id !== finalQuoteId) {
        throw new QuoteAcceptanceError(
          "A newer final quote is available. Review that version before accepting.",
        );
      }
      if (latest.acceptedAt) return toFinalQuoteResponse(latest);

      const acceptedAt = new Date();
      const [accepted] = await transaction
        .update(finalQuotes)
        .set({ acceptedAt })
        .where(
          and(
            eq(finalQuotes.id, latest.id),
            sql`${finalQuotes.acceptedAt} is null`,
          ),
        )
        .returning();
      if (!accepted) {
        const [alreadyAccepted] = await transaction
          .select()
          .from(finalQuotes)
          .where(eq(finalQuotes.id, latest.id))
          .limit(1);
        if (alreadyAccepted?.acceptedAt) {
          return toFinalQuoteResponse(alreadyAccepted);
        }
        throw new DataIntegrityError("Failed to accept the final quote");
      }

      await transaction
        .update(jobRequests)
        .set({
          finalQuoteAmountMinor: accepted.amountMinor,
          updatedAt: acceptedAt,
        })
        .where(eq(jobRequests.id, current.id));
      await transaction
        .update(paymentObligations)
        .set({ status: "ready", updatedAt: acceptedAt })
        .where(
          and(
            eq(paymentObligations.tenantId, tenantId),
            eq(paymentObligations.accountId, accountId),
            eq(paymentObligations.finalQuoteId, accepted.id),
          ),
        );

      const eventId = randomUUID();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: jobRequestId,
        eventType: "commerce.job_request.final_quote.accepted.v1",
        occurredAt: acceptedAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.final_quote.accepted.v1",
          version: 1,
          aggregateId: jobRequestId,
          tenantId,
          accountId,
          occurredAt: acceptedAt.toISOString(),
          actor,
          source: command.source,
          data: {
            finalQuoteId: accepted.id,
            amountMinor: accepted.amountMinor,
            currency: accepted.currency,
            quoteVersion: accepted.version,
          },
        },
      });

      if (current.status === "approved") {
        await this.applyTransition(
          transaction,
          current,
          "awaiting_payment",
          "Customer accepted the final quote",
          actor,
          command.source,
        );
      }
      return toFinalQuoteResponse(accepted);
    });
  }

  /**
   * Customer reply when the job is parked on `changes_requested`.
   *
   * The state machine already allows `changes_requested → submitted`. This
   * method is the customer-owned path: it requires a note, scopes to the
   * signed-in person, appends the reply to the job note, and optionally
   * attaches replacement artwork as a proof waiting on staff.
   */
  async respondToChanges(
    jobRequestId: string,
    command: RespondToChanges,
    actor: Actor,
    customerPersonId?: string,
  ): Promise<JobRequestResponse> {
    const { tenantId, accountId } = command.context;
    if (actor.type !== "customer" || !actor.id) {
      throw new ScopeMismatchError(
        "Responding to requested changes requires an identified customer",
      );
    }
    const note = command.note.trim();
    if (!note) {
      throw new CustomerActionError(
        "Tell us what you changed so we can review the revision.",
      );
    }

    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
        customerPersonId,
      );
      if (current.status !== "changes_requested") {
        throw new CustomerActionError(
          "This job is not waiting on a revision from you.",
        );
      }

      const occurredAt = new Date();
      const stamped = `Revision (${occurredAt.toISOString()}): ${note}`;
      const customerNote = current.customerNote
        ? `${current.customerNote}\n\n${stamped}`
        : stamped;
      const [noted] = await transaction
        .update(jobRequests)
        .set({ customerNote, updatedAt: occurredAt })
        .where(
          and(
            eq(jobRequests.tenantId, tenantId),
            eq(jobRequests.accountId, accountId),
            eq(jobRequests.id, jobRequestId),
            eq(jobRequests.version, current.version),
          ),
        )
        .returning();
      if (!noted) {
        throw new DataIntegrityError("Concurrent job request update detected");
      }

      if (command.storageKey) {
        const [latest] = await transaction
          .select({ version: proofVersions.version })
          .from(proofVersions)
          .where(
            and(
              eq(proofVersions.tenantId, tenantId),
              eq(proofVersions.accountId, accountId),
              eq(proofVersions.jobRequestId, jobRequestId),
            ),
          )
          .orderBy(desc(proofVersions.version))
          .limit(1);
        const version = (latest?.version ?? 0) + 1;
        const [created] = await transaction
          .insert(proofVersions)
          .values({
            tenantId,
            accountId,
            jobRequestId,
            version,
            storageKey: command.storageKey,
            note,
            decision: "pending",
            awaitingDecisionFrom: "staff",
            createdBy: actor,
            source: command.source,
          })
          .returning();
        if (!created) {
          throw new DataIntegrityError("Failed to create proof version");
        }
      }

      return this.applyTransition(
        transaction,
        { ...current, customerNote, updatedAt: occurredAt },
        "submitted",
        command.storageKey
          ? `${note}\n\nReplacement artwork attached.`
          : note,
        actor,
        command.source,
        "commerce.job_request.changes_responded.v1",
      );
    });
  }

  /**
   * Records that the customer asked staff to send a manual invoice.
   *
   * Online card payment is not connected. This is the honest customer action
   * after quote acceptance: it marks the latest obligation and emails staff.
   */
  async requestInvoice(
    jobRequestId: string,
    command: RequestInvoice,
    actor: Actor,
    customerPersonId?: string,
  ): Promise<InvoiceRequestResponse> {
    const { tenantId, accountId } = command.context;
    if (actor.type !== "customer" || !actor.id) {
      throw new ScopeMismatchError(
        "Requesting an invoice requires an identified customer",
      );
    }

    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
        customerPersonId,
      );
      if (
        current.status !== "awaiting_payment" &&
        current.status !== "payment_failed"
      ) {
        throw new CustomerActionError(
          "An invoice can be requested after you accept the final quote.",
        );
      }

      const [latestQuote] = await transaction
        .select()
        .from(finalQuotes)
        .where(
          and(
            eq(finalQuotes.tenantId, tenantId),
            eq(finalQuotes.accountId, accountId),
            eq(finalQuotes.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(desc(finalQuotes.version))
        .limit(1);
      if (!latestQuote?.acceptedAt) {
        throw new CustomerActionError(
          "Accept the final quote before requesting an invoice.",
        );
      }

      const [obligation] = await transaction
        .select()
        .from(paymentObligations)
        .where(
          and(
            eq(paymentObligations.tenantId, tenantId),
            eq(paymentObligations.accountId, accountId),
            eq(paymentObligations.finalQuoteId, latestQuote.id),
          ),
        )
        .limit(1);
      if (!obligation) {
        throw new ResourceNotFoundError("Payment obligation not found");
      }
      if (obligation.status === "invoice_requested") {
        return { invoiceRequestedAt: obligation.updatedAt.toISOString() };
      }

      const requestedAt = new Date();
      const [updated] = await transaction
        .update(paymentObligations)
        .set({ status: "invoice_requested", updatedAt: requestedAt })
        .where(
          and(
            eq(paymentObligations.id, obligation.id),
            eq(paymentObligations.status, obligation.status),
          ),
        )
        .returning();
      if (!updated) {
        const [again] = await transaction
          .select()
          .from(paymentObligations)
          .where(eq(paymentObligations.id, obligation.id))
          .limit(1);
        if (again?.status === "invoice_requested") {
          return { invoiceRequestedAt: again.updatedAt.toISOString() };
        }
        throw new DataIntegrityError("Failed to record the invoice request");
      }

      const eventId = randomUUID();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: jobRequestId,
        eventType: "commerce.job_request.invoice.requested.v1",
        occurredAt: requestedAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.invoice.requested.v1",
          version: 1,
          aggregateId: jobRequestId,
          tenantId,
          accountId,
          occurredAt: requestedAt.toISOString(),
          actor,
          source: command.source,
          data: {
            finalQuoteId: latestQuote.id,
            amountMinor: latestQuote.amountMinor,
            currency: latestQuote.currency,
            quoteVersion: latestQuote.version,
          },
        },
      });

      return { invoiceRequestedAt: requestedAt.toISOString() };
    });
  }

  /**
   * Staff confirm they sent a manual invoice. Moves the job to
   * `payment_pending` and emails the customer.
   */
  async issueInvoice(
    jobRequestId: string,
    command: IssueInvoice,
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
      if (
        current.status !== "awaiting_payment" &&
        current.status !== "payment_failed" &&
        current.status !== "payment_pending"
      ) {
        throw new JobActionError(
          "An invoice can be issued after the customer accepts the final quote.",
        );
      }
      if (current.status === "payment_pending") {
        return toResponse(current);
      }
      return this.applyTransition(
        transaction,
        current,
        "payment_pending",
        command.note ?? "Manual invoice issued",
        actor,
        command.source,
        "commerce.job_request.invoice.issued.v1",
      );
    });
  }

  /**
   * Staff record that money arrived (e-transfer, cheque, card over the phone).
   * This is the offline stand-in for a Stripe webhook.
   */
  async recordPayment(
    jobRequestId: string,
    command: RecordPayment,
    actor: Actor,
  ): Promise<JobRequestResponse> {
    const note = command.note.trim();
    if (!note) {
      throw new JobActionError("Say how the payment was received.");
    }
    const { tenantId, accountId } = command.context;
    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
      );
      if (
        current.status !== "awaiting_payment" &&
        current.status !== "payment_pending" &&
        current.status !== "payment_failed"
      ) {
        throw new JobActionError(
          "Payment can be recorded after the customer accepts the final quote.",
        );
      }
      return this.applyTransition(
        transaction,
        current,
        "paid",
        note,
        actor,
        command.source,
        "commerce.job_request.payment.recorded.v1",
      );
    });
  }

  async createProof(
    jobRequestId: string,
    command: CreateProofVersion,
    actor: Actor,
  ): Promise<ProofVersionResponse> {
    const { tenantId, accountId } = command.context;
    return this.db.transaction(async (transaction) => {
      await this.findScoped(transaction, tenantId, accountId, jobRequestId);
      const [latest] = await transaction
        .select({ version: proofVersions.version })
        .from(proofVersions)
        .where(
          and(
            eq(proofVersions.tenantId, tenantId),
            eq(proofVersions.accountId, accountId),
            eq(proofVersions.jobRequestId, jobRequestId),
          ),
        )
        .orderBy(desc(proofVersions.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      // A proof is always waiting on the other side of the table. Callers may
      // override it — staff revising a customer's artwork still hand it back to
      // the customer rather than to themselves.
      const awaitingDecisionFrom =
        command.awaitingDecisionFrom ?? defaultAudienceForAuthor(actor);
      const [created] = await transaction
        .insert(proofVersions)
        .values({
          tenantId,
          accountId,
          jobRequestId,
          version,
          storageKey: command.storageKey,
          note: command.note ?? null,
          decision: "pending",
          awaitingDecisionFrom,
          createdBy: actor,
          source: command.source,
        })
        .returning();
      if (!created) {
        throw new DataIntegrityError("Failed to create proof version");
      }

      const eventId = randomUUID();
      const occurredAt = new Date();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: jobRequestId,
        eventType: "commerce.job_request.proof.created.v1",
        occurredAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.proof.created.v1",
          version: 1,
          aggregateId: jobRequestId,
          tenantId,
          accountId,
          occurredAt: occurredAt.toISOString(),
          actor,
          source: command.source,
          data: {
            proofId: created.id,
            proofVersion: version,
            storageKey: command.storageKey,
            note: command.note,
            awaitingDecisionFrom,
          },
        },
      });

      return toProofResponse(created);
    });
  }

  /**
   * Records one side's verdict on a proof and moves the job to match.
   *
   * The job status is the thing customers and staff actually watch, so a
   * decision that only wrote `proof_versions.decision` would be invisible.
   * Approving from `under_review` advances the job; asking for changes sends it
   * back. When the job is not in `under_review` the decision is still recorded
   * but the status is left alone, because every other state (paid, rejected)
   * has a stronger claim on it than a late proof comment.
   */
  async decideProof(
    jobRequestId: string,
    proofId: string,
    command: DecideProof,
    actor: Actor,
    customerPersonId?: string,
  ): Promise<ProofVersionResponse> {
    const { tenantId, accountId } = command.context;
    // Staff decide through the admin router and are not narrowed to one
    // customer. A private-store owner may decide a teammate's proof because
    // the route passes the same whole-account visibility used by their
    // portal; retail customers always arrive with their own person filter.
    return this.db.transaction(async (transaction) => {
      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
        customerPersonId,
      );

      const [proof] = await transaction
        .select()
        .from(proofVersions)
        .where(
          and(
            eq(proofVersions.tenantId, tenantId),
            eq(proofVersions.accountId, accountId),
            eq(proofVersions.jobRequestId, jobRequestId),
            eq(proofVersions.id, proofId),
          ),
        )
        .limit(1);

      if (!proof) {
        throw new ResourceNotFoundError("Proof version not found");
      }
      assertProofDecidable(proof, command.decision, command.note, actor);

      const occurredAt = new Date();
      const [updated] = await transaction
        .update(proofVersions)
        .set({
          decision: command.decision,
          decidedAt: occurredAt,
          decidedBy: actor,
          decisionNote: command.note ?? null,
          awaitingDecisionFrom: null,
          updatedAt: occurredAt,
        })
        .where(
          and(
            eq(proofVersions.id, proof.id),
            eq(proofVersions.tenantId, tenantId),
            eq(proofVersions.accountId, accountId),
          ),
        )
        .returning();

      if (!updated) {
        throw new DataIntegrityError("Failed to record proof decision");
      }

      const toStatus = statusForProofDecision(current.status, command.decision);
      if (toStatus) {
        await this.applyTransition(
          transaction,
          current,
          toStatus,
          command.note ?? `Proof v${proof.version} ${command.decision}`,
          actor,
          command.source,
        );
      }

      const eventId = randomUUID();
      await transaction.insert(outboxEvents).values({
        id: eventId,
        tenantId,
        accountId,
        aggregateType: "job_request",
        aggregateId: jobRequestId,
        eventType: "commerce.job_request.proof.decided.v1",
        occurredAt,
        payload: {
          id: eventId,
          type: "commerce.job_request.proof.decided.v1",
          version: 1,
          aggregateId: jobRequestId,
          tenantId,
          accountId,
          occurredAt: occurredAt.toISOString(),
          actor,
          source: command.source,
          data: {
            proofId: updated.id,
            proofVersion: updated.version,
            decision: command.decision,
            note: command.note,
            decidedBy: audienceForActor(actor),
          },
        },
      });

      return toProofResponse(updated);
    });
  }

  /**
   * Lists job requests in an account, optionally narrowed to one customer's
   * own. See `findScoped` for why customer-facing callers must always narrow.
   */
  /**
   * Orders in one account, narrowed to a single person unless the caller is
   * entitled to the whole account. The placer's name rides along so a team
   * store's owner reads a roster rather than a column of order numbers; it is
   * the account's own membership, not anyone else's.
   */
  async list(
    tenantId: string,
    accountId: string,
    customerPersonId?: string,
  ): Promise<JobRequestResponse[]> {
    const rows = await this.db
      .select({ job: jobListColumns, placedBy: people.displayName })
      .from(jobRequests)
      .leftJoin(people, eq(people.id, jobRequests.customerPersonId))
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.accountId, accountId),
          ...(customerPersonId
            ? [eq(jobRequests.customerPersonId, customerPersonId)]
            : []),
        ),
      )
      .orderBy(desc(jobRequests.createdAt));

    return rows.map((row) => ({
      ...toResponse(row.job),
      customerName: row.placedBy,
    }));
  }

  /**
   * Every job in the tenant, for the staff inbox.
   *
   * Staff work across accounts by definition: a branded team store signs up
   * with an account of its own, so an account-scoped inbox showed head office
   * nothing a team store had ordered. The rows were in the database and no one
   * who could fulfil them was able to see them.
   */
  async listForStaff(tenantId: string): Promise<JobRequestResponse[]> {
    const rows = await this.db
      .select({ job: jobListColumns, placedBy: people.displayName })
      .from(jobRequests)
      .leftJoin(people, eq(people.id, jobRequests.customerPersonId))
      .where(eq(jobRequests.tenantId, tenantId))
      .orderBy(desc(jobRequests.createdAt));

    const jobIds = rows.map((row) => row.job.id);
    let requested: Array<{ jobRequestId: string; updatedAt: Date }> = [];
    if (jobIds.length) {
      try {
        requested = await this.db
          .select({
            jobRequestId: paymentObligations.jobRequestId,
            updatedAt: paymentObligations.updatedAt,
          })
          .from(paymentObligations)
          .where(
            and(
              eq(paymentObligations.tenantId, tenantId),
              eq(paymentObligations.status, "invoice_requested"),
              inArray(paymentObligations.jobRequestId, jobIds),
            ),
          );
      } catch (error) {
        const state = postgresSqlState(error);
        if (state !== "42703" && state !== "42P01") throw error;
      }
    }
    const requestedAt = new Map(
      requested.map((row) => [row.jobRequestId, row.updatedAt.toISOString()]),
    );

    return rows.map((row) => ({
      ...toResponse(row.job),
      customerName: row.placedBy,
      invoiceRequestedAt: requestedAt.get(row.job.id) ?? null,
    }));
  }

  /**
   * The account and store a job actually belongs to.
   *
   * Staff routes resolve this from the row instead of trusting the caller's
   * own scope, which lets them act on a team store's job without loosening a
   * single customer-facing check.
   */
  async locateForStaff(
    tenantId: string,
    jobRequestId: string,
  ): Promise<{ accountId: string; storeId: string }> {
    const [row] = await this.db
      .select({
        accountId: jobRequests.accountId,
        storeId: jobRequests.storeId,
      })
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.id, jobRequestId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundError("Job request not found in this tenant");
    }
    return row;
  }

  private async transitionWithIdempotency(
    jobRequestId: string,
    command: SubmitJobRequest,
    toStatus: JobRequestStatus,
    idempotencyKey: string,
    actor: Actor,
    operationPrefix: string,
    customerPersonId?: string,
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
            customerPersonId,
          ),
        );
      }

      const current = await this.findScoped(
        transaction,
        tenantId,
        accountId,
        jobRequestId,
        customerPersonId,
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
    eventTypeOverride?: CommerceEventType,
    notifyCustomer = true,
  ): Promise<JobRequestResponse> {
    if (toStatus === "cancelled" && !reason?.trim()) {
      throw new JobActionError("A reason is required to cancel a job.");
    }
    const occurredAt = new Date();
    const paymentStatus =
      toStatus === "awaiting_payment"
        ? ("requires_payment" as const)
        : toStatus === "payment_pending"
          ? ("processing" as const)
          : toStatus === "payment_failed"
            ? ("failed" as const)
            : toStatus === "paid"
              ? ("succeeded" as const)
              : toStatus === "cancelled" && current.paymentStatus !== "succeeded"
                ? ("cancelled" as const)
                : current.paymentStatus;
    const [updated] = await transaction
      .update(jobRequests)
      .set({
        status: toStatus,
        version: current.version + 1,
        submittedAt:
          toStatus === "submitted" ? occurredAt : current.submittedAt,
        paymentStatus,
        paidAt: toStatus === "paid" ? occurredAt : current.paidAt,
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

    if (toStatus === "payment_pending" || toStatus === "paid") {
      const [latestQuote] = await transaction
        .select({ id: finalQuotes.id })
        .from(finalQuotes)
        .where(
          and(
            eq(finalQuotes.tenantId, current.tenantId),
            eq(finalQuotes.accountId, current.accountId),
            eq(finalQuotes.jobRequestId, current.id),
          ),
        )
        .orderBy(desc(finalQuotes.version))
        .limit(1);
      if (latestQuote) {
        await transaction
          .update(paymentObligations)
          .set({
            status: toStatus === "paid" ? "paid" : "invoiced",
            updatedAt: occurredAt,
          })
          .where(
            and(
              eq(paymentObligations.tenantId, current.tenantId),
              eq(paymentObligations.accountId, current.accountId),
              eq(paymentObligations.finalQuoteId, latestQuote.id),
            ),
          );
      }
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
      eventTypeOverride ??
      (toStatus === "submitted"
        ? "commerce.job_request.submitted.v1"
        : "commerce.job_request.status_changed.v1");
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
          notifyCustomer,
        },
      },
    });

    return toResponse(updated);
  }

  /**
   * Re-checks catalog qty for each line. Missing SKUs stay `available: null`
   * so staff see a warning instead of a hard block.
   */
  private async checkInventory(
    tenantId: string,
    lines: Array<{ id: string; snapshot: JobRequestLineInput }>,
  ): Promise<InventoryCheck> {
    const variantIds = [
      ...new Set(
        lines
          .map((line) => line.snapshot.variantId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const productIds = [
      ...new Set(
        lines
          .map((line) => line.snapshot.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const variants = variantIds.length
      ? await this.db
          .select({
            id: ssVariants.id,
            qty: ssVariants.qty,
            sku: ssVariants.sku,
          })
          .from(ssVariants)
          .where(
            and(
              eq(ssVariants.tenantId, tenantId),
              inArray(ssVariants.id, variantIds),
            ),
          )
      : [];
    const products = productIds.length
      ? await this.db
          .select({ id: ssProducts.id, qty: ssProducts.qty })
          .from(ssProducts)
          .where(
            and(
              eq(ssProducts.tenantId, tenantId),
              inArray(ssProducts.id, productIds),
            ),
          )
      : [];
    const variantById = new Map(variants.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));

    return {
      lines: lines.map((line) => {
        const variant = line.snapshot.variantId
          ? variantById.get(line.snapshot.variantId)
          : undefined;
        const product = line.snapshot.productId
          ? productById.get(line.snapshot.productId)
          : undefined;
        const available = variant?.qty ?? product?.qty ?? null;
        return {
          lineId: line.id,
          description: line.snapshot.description,
          requested: line.snapshot.quantity,
          available,
          sku: variant?.sku ?? null,
        };
      }),
    };
  }

  /**
   * Loads a job request inside a tenant/account scope.
   *
   * `customerPersonId` narrows the lookup to a single customer's own job and
   * must be supplied on every customer-initiated path. Account scope alone is
   * not an authorization boundary for retail customers: an unbranded public
   * storefront enrols every shopper who signs in into one shared account, so
   * without the person filter one customer's id would match another's job.
   * Staff paths intentionally pass nothing, because reviewing any job in the
   * account is the entire point of the admin router.
   */
  private async findScoped(
    executor: Pick<CommerceDatabase, "select">,
    tenantId: string,
    accountId: string,
    jobRequestId: string,
    customerPersonId?: string,
  ): Promise<typeof jobRequests.$inferSelect> {
    const [row] = await executor
      .select()
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.accountId, accountId),
          eq(jobRequests.id, jobRequestId),
          ...(customerPersonId
            ? [eq(jobRequests.customerPersonId, customerPersonId)]
            : []),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ResourceNotFoundError("Job request not found in account scope");
    }
    return row;
  }
}
