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
  PricingConfig,
  SourceMetadata,
} from "@gwg/contracts";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: jsonb("created_by").$type<Actor>(),
  source: jsonb("source").$type<SourceMetadata>(),
};

export const storeStatusEnum = pgEnum("store_status", [
  "pending_review",
  "active",
  "suspended",
]);

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
    status: storeStatusEnum("status").notNull().default("active"),
    logoUrl: text("logo_url"),
    accentColor: text("accent_color"),
    tagline: text("tagline"),
    customDomain: text("custom_domain"),
    // Signed decimal string, e.g. "-0.1" for a 10% storewide discount off
    // the tenant's published pricing config, "0.05" for a 5% markup. Null
    // means no override — the store sees the tenant's published pricing
    // unchanged. Applied to markup multipliers only, not flat fees.
    pricingAdjustmentPercent: text("pricing_adjustment_percent"),
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
    // Subdomains are resolved per-tenant regardless of which account owns
    // the store, so the slug must be unique across the whole tenant, not
    // just within one account.
    uniqueIndex("stores_tenant_slug_uq").on(table.tenantId, table.slug),
    uniqueIndex("stores_custom_domain_uq").on(table.customDomain),
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
    role: text("role").notNull().default("member"),
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

export const accountInvites = pgTable(
  "account_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedBy: jsonb("invited_by").$type<Actor>(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("account_invites_token_uq").on(table.token),
    index("account_invites_tenant_account_email_idx").on(
      table.tenantId,
      table.accountId,
      table.email,
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

/** S&S style = garment silhouette / style number (e.g. Gildan 2000). */
export const ssStyles = pgTable(
  "ss_styles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    styleId: integer("style_id").notNull(),
    partNumber: text("part_number"),
    brandName: text("brand_name").notNull(),
    styleName: text("style_name").notNull(),
    title: text("title"),
    description: text("description"),
    baseCategory: text("base_category"),
    ssCategories: jsonb("ss_categories").$type<string[]>().notNull().default([]),
    brandImagePath: text("brand_image_path"),
    styleImagePath: text("style_image_path"),
    brandImageUrl: text("brand_image_url"),
    styleImageUrl: text("style_image_url"),
    active: boolean("active").notNull().default(true),
    modelUrl: text("model_url"),
    modelStatus: text("model_status").notNull().default("none"),
    modelSource: text("model_source"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_styles_tenant_style_id_uq").on(table.tenantId, table.styleId),
    index("ss_styles_tenant_brand_idx").on(table.tenantId, table.brandName),
  ],
);

/** Website product = S&S style + color. */
export const ssProducts = pgTable(
  "ss_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    styleUuid: uuid("style_uuid")
      .notNull()
      .references(() => ssStyles.id),
    styleId: integer("style_id").notNull(),
    colorName: text("color_name").notNull(),
    colorCode: text("color_code"),
    color1: text("color1"),
    color2: text("color2"),
    isDark: boolean("is_dark").notNull().default(false),
    colorFrontImagePath: text("color_front_image_path"),
    colorSideImagePath: text("color_side_image_path"),
    colorBackImagePath: text("color_back_image_path"),
    colorSwatchImagePath: text("color_swatch_image_path"),
    colorFrontImageUrl: text("color_front_image_url"),
    colorSideImageUrl: text("color_side_image_url"),
    colorBackImageUrl: text("color_back_image_url"),
    colorSwatchImageUrl: text("color_swatch_image_url"),
    materialConfig: jsonb("material_config").$type<Record<string, unknown>>(),
    qty: integer("qty").notNull().default(0),
    active: boolean("active").notNull().default(true),
    slug: text("slug").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_products_tenant_style_color_uq").on(
      table.tenantId,
      table.styleId,
      table.colorName,
    ),
    uniqueIndex("ss_products_tenant_slug_uq").on(table.tenantId, table.slug),
    index("ss_products_tenant_style_uuid_idx").on(table.tenantId, table.styleUuid),
  ],
);

/** Variant = size under a color product. */
export const ssVariants = pgTable(
  "ss_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productUuid: uuid("product_uuid")
      .notNull()
      .references(() => ssProducts.id),
    skuId: integer("sku_id").notNull(),
    sku: text("sku").notNull(),
    gtin: text("gtin"),
    sizeName: text("size_name").notNull(),
    sizeCode: text("size_code"),
    sizeOrder: integer("size_order").notNull().default(0),
    customerPriceMinor: bigint("customer_price_minor", { mode: "number" }).notNull(),
    mapPriceMinor: bigint("map_price_minor", { mode: "number" }),
    qty: integer("qty").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_variants_tenant_sku_id_uq").on(table.tenantId, table.skuId),
    uniqueIndex("ss_variants_tenant_sku_uq").on(table.tenantId, table.sku),
    index("ss_variants_tenant_product_idx").on(table.tenantId, table.productUuid),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("categories_tenant_slug_uq").on(table.tenantId, table.slug),
    index("categories_tenant_parent_idx").on(table.tenantId, table.parentId),
  ],
);

// A store with zero rows here sees the full tenant catalog (default,
// unchanged behaviour). Rows present restrict that store's storefront to
// only the listed categories — staff-curated per corporate client.
export const storeCategoryVisibility = pgTable(
  "store_category_visibility",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("store_category_visibility_uq").on(
      table.storeId,
      table.categoryId,
    ),
    index("store_category_visibility_store_idx").on(table.storeId),
  ],
);

export const ssProductCategories = pgTable(
  "ss_product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productUuid: uuid("product_uuid")
      .notNull()
      .references(() => ssProducts.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    assignmentSource: text("assignment_source").notNull().default("map"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_product_categories_uq").on(
      table.tenantId,
      table.productUuid,
      table.categoryId,
    ),
  ],
);

export const ssCategoryMap = pgTable(
  "ss_category_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    ssCategoryKey: text("ss_category_key").notNull(),
    ssCategoryLabel: text("ss_category_label"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    productCount: integer("product_count").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_category_map_uq").on(
      table.tenantId,
      table.ssCategoryKey,
      table.categoryId,
    ),
  ],
);

export const categoryOverrides = pgTable(
  "category_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productUuid: uuid("product_uuid")
      .notNull()
      .references(() => ssProducts.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("category_overrides_uq").on(
      table.tenantId,
      table.productUuid,
      table.categoryId,
    ),
  ],
);

export const ssUnmappedCategories = pgTable(
  "ss_unmapped_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    ssCategoryKey: text("ss_category_key").notNull(),
    ssCategoryLabel: text("ss_category_label"),
    styleCount: integer("style_count").notNull().default(0),
    sampleStyleIds: jsonb("sample_style_ids").$type<number[]>().notNull().default([]),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ss_unmapped_categories_uq").on(table.tenantId, table.ssCategoryKey),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    status: text("status").notNull(),
    stylesProcessed: integer("styles_processed").notNull().default(0),
    skusUpserted: integer("skus_upserted").notNull().default(0),
    imagesDownloaded: integer("images_downloaded").notNull().default(0),
    rateLimitRemaining: integer("rate_limit_remaining"),
    errorSummary: text("error_summary"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("sync_runs_tenant_started_idx").on(table.tenantId, table.startedAt),
  ],
);

export const catalogSettings = pgTable(
  "catalog_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    retailMarkup: text("retail_markup").notNull().default("2.0"),
    brandAllowlist: jsonb("brand_allowlist").$type<string[]>().notNull().default([]),
    storageConfig: jsonb("storage_config").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("catalog_settings_tenant_uq").on(table.tenantId),
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

export const designProjects = pgTable(
  "design_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    name: text("name").notNull(),
    garmentProductId: uuid("garment_product_id").references(() => ssProducts.id),
    artworksBySide: jsonb("artworks_by_side").notNull(),
    proofImageUrl: text("proof_image_url"),
    ...auditColumns,
  },
  (table) => [
    index("design_projects_tenant_person_idx").on(
      table.tenantId,
      table.personId,
    ),
  ],
);

export const pricingConfigs = pgTable(
  "pricing_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    config: jsonb("config").$type<PricingConfig>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("pricing_configs_tenant_version_uq").on(
      table.tenantId,
      table.version,
    ),
    uniqueIndex("pricing_configs_tenant_published_uq")
      .on(table.tenantId)
      .where(sql`${table.status} = 'published'`),
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
