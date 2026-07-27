import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Actor,
  CommerceEventEnvelope,
  JobRequestLineInput,
  SourceMetadata,
} from "@gwg/contracts";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: jsonb("created_by").$type<Actor>(),
  source: jsonb("source").$type<SourceMetadata>(),
};

export const jobRequestStatusEnum = pgEnum("job_request_status", [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "rejected",
  "approved",
  "awaiting_payment",
  "payment_pending",
  "payment_failed",
  "paid",
  "ready_for_production",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ...auditColumns,
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("accounts_tenant_id_id_uq").on(table.tenantId, table.id)],
);

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("stores_tenant_account_slug_uq").on(
      table.tenantId,
      table.accountId,
      table.slug,
    ),
    uniqueIndex("stores_scope_id_uq").on(
      table.tenantId,
      table.accountId,
      table.id,
    ),
  ],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email"),
    displayName: text("display_name"),
    phone: text("phone"),
    ...auditColumns,
  },
  (table) => [index("people_tenant_email_idx").on(table.tenantId, table.email)],
);

export const accountPeople = pgTable(
  "account_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    customerReference: text("customer_reference"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("account_people_scope_person_uq").on(
      table.tenantId,
      table.accountId,
      table.personId,
    ),
  ],
);

export const externalIdentities = pgTable(
  "external_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    system: text("system").notNull(),
    externalId: text("external_id").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("external_identities_tenant_system_external_uq").on(
      table.tenantId,
      table.system,
      table.externalId,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("products_tenant_id_uq").on(table.tenantId, table.id)],
);

export const productStyles = pgTable(
  "product_styles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("product_styles_tenant_id_uq").on(table.tenantId, table.id)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    styleId: uuid("style_id")
      .notNull()
      .references(() => productStyles.id),
    sku: text("sku").notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("product_variants_tenant_sku_uq").on(table.tenantId, table.sku),
  ],
);

export const vendorMappings = pgTable(
  "vendor_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    vendor: text("vendor").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    externalId: text("external_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("vendor_mappings_tenant_vendor_external_uq").on(
      table.tenantId,
      table.vendor,
      table.entityType,
      table.externalId,
    ),
  ],
);

export const jobRequests = pgTable(
  "job_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    customerPersonId: uuid("customer_person_id")
      .notNull()
      .references(() => people.id),
    status: jobRequestStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    customerNote: text("customer_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("job_requests_scope_id_uq").on(
      table.tenantId,
      table.accountId,
      table.id,
    ),
    index("job_requests_scope_status_idx").on(
      table.tenantId,
      table.accountId,
      table.status,
    ),
  ],
);

export const jobRequestLines = pgTable(
  "job_request_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    position: integer("position").notNull(),
    snapshot: jsonb("snapshot").$type<JobRequestLineInput>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_request_lines_request_position_uq").on(
      table.jobRequestId,
      table.position,
    ),
    index("job_request_lines_scope_request_idx").on(
      table.tenantId,
      table.accountId,
      table.jobRequestId,
    ),
  ],
);

export const jobRequestSnapshots = pgTable(
  "job_request_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    version: integer("version").notNull(),
    reason: text("reason").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: jsonb("created_by").$type<Actor>().notNull(),
    source: jsonb("source").$type<SourceMetadata>().notNull(),
  },
  (table) => [
    uniqueIndex("job_request_snapshots_request_version_uq").on(
      table.jobRequestId,
      table.version,
    ),
  ],
);

export const artworkVersions = pgTable(
  "artwork_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    version: integer("version").notNull(),
    storageKey: text("storage_key").notNull(),
    checksum: text("checksum").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("artwork_versions_request_version_uq").on(
      table.jobRequestId,
      table.version,
    ),
  ],
);

export const proofVersions = pgTable(
  "proof_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    artworkVersionId: uuid("artwork_version_id").references(() => artworkVersions.id),
    version: integer("version").notNull(),
    storageKey: text("storage_key").notNull(),
    decision: text("decision"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("proof_versions_request_version_uq").on(
      table.jobRequestId,
      table.version,
    ),
  ],
);

export const jobRequestStatusHistory = pgTable(
  "job_request_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    fromStatus: jobRequestStatusEnum("from_status"),
    toStatus: jobRequestStatusEnum("to_status").notNull(),
    reason: text("reason"),
    actor: jsonb("actor").$type<Actor>().notNull(),
    source: jsonb("source").$type<SourceMetadata>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_request_history_scope_request_idx").on(
      table.tenantId,
      table.accountId,
      table.jobRequestId,
      table.occurredAt,
    ),
  ],
);

export const finalQuotes = pgTable(
  "final_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    version: integer("version").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("final_quotes_request_version_uq").on(
      table.jobRequestId,
      table.version,
    ),
  ],
);

export const paymentObligations = pgTable(
  "payment_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    finalQuoteId: uuid("final_quote_id")
      .notNull()
      .references(() => finalQuotes.id),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    externalReference: text("external_reference"),
    ...auditColumns,
  },
  (table) => [
    index("payment_obligations_scope_request_idx").on(
      table.tenantId,
      table.accountId,
      table.jobRequestId,
    ),
  ],
);

export const paymentSessions = pgTable(
  "payment_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    jobRequestId: uuid("job_request_id")
      .notNull()
      .references(() => jobRequests.id),
    paymentObligationId: uuid("payment_obligation_id")
      .notNull()
      .references(() => paymentObligations.id),
    provider: text("provider").notNull(),
    externalSessionId: text("external_session_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("payment_sessions_scope_idempotency_uq").on(
      table.tenantId,
      table.accountId,
      table.provider,
      table.idempotencyKey,
    ),
    uniqueIndex("payment_sessions_provider_external_uq").on(
      table.provider,
      table.externalSessionId,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    resourceId: uuid("resource_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_scope_operation_key_uq").on(
      table.tenantId,
      table.accountId,
      table.operation,
      table.key,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<CommerceEventEnvelope>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [
    index("outbox_events_pending_idx")
      .on(table.availableAt)
      .where(sql`${table.publishedAt} is null`),
  ],
);

export const inboxMessages = pgTable(
  "inbox_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    accountId: uuid("account_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    messageId: text("message_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("inbox_messages_scope_source_message_uq").on(
      table.tenantId,
      table.accountId,
      table.sourceSystem,
      table.messageId,
    ),
  ],
);
