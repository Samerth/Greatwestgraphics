import { z } from "zod";

export * from "./pricing-v2.js";

export const CanonicalIdSchema = z.string().uuid();
export type CanonicalId = z.infer<typeof CanonicalIdSchema>;

export const JobRequestStatuses = [
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
] as const;

export const JobRequestStatusSchema = z.enum(JobRequestStatuses);
export type JobRequestStatus = z.infer<typeof JobRequestStatusSchema>;

/** Canonical legal transitions for staff UI and API domain logic. */
export const JobRequestTransitions = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected"],
  under_review: ["changes_requested", "rejected", "approved"],
  changes_requested: ["submitted", "rejected"],
  rejected: [],
  approved: ["awaiting_payment"],
  awaiting_payment: ["payment_pending"],
  payment_pending: ["payment_failed", "paid"],
  payment_failed: ["payment_pending"],
  paid: ["ready_for_production"],
  ready_for_production: [],
} as const satisfies Record<JobRequestStatus, readonly JobRequestStatus[]>;

export function validNextStatuses(
  status: JobRequestStatus,
): readonly JobRequestStatus[] {
  return JobRequestTransitions[status];
}

export const ActorTypes = ["customer", "staff", "system", "integration"] as const;
export const ActorSchema = z.object({
  type: z.enum(ActorTypes),
  id: CanonicalIdSchema.optional(),
  displayName: z.string().min(1).max(200).optional(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const SourceSystems = [
  "storefront",
  "commerce_api",
  "codcrm",
  "codchat",
  "stripe",
  "vendor",
] as const;
export const SourceMetadataSchema = z.object({
  system: z.enum(SourceSystems),
  externalId: z.string().min(1).max(255).optional(),
  correlationId: z.string().min(1).max(255).optional(),
});
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;

export const RequestContextSchema = z.object({
  tenantId: CanonicalIdSchema,
  accountId: CanonicalIdSchema,
  storeId: CanonicalIdSchema,
});
export type RequestContext = z.infer<typeof RequestContextSchema>;

export const CommerceHeaders = {
  tenantId: "x-tenant-id",
  accountId: "x-account-id",
  storeId: "x-store-id",
  actorId: "x-actor-id",
  idempotencyKey: "idempotency-key",
  correlationId: "x-correlation-id",
} as const;

export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const MinorAmountSchema = z.number().int().nonnegative();
export type MinorAmount = z.infer<typeof MinorAmountSchema>;

export const QtyTierSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive().nullable(),
});
export type QtyTier = z.infer<typeof QtyTierSchema>;

export const PricingConfigStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
export type PricingConfigStatus = z.infer<typeof PricingConfigStatusSchema>;

export const PricingSettingsSchema = z.object({
  minimumOrderQty: z.number().int().positive(),
  setupFeeNewPerColourMinor: MinorAmountSchema,
  setupFeeRepeatPerColourMinor: MinorAmountSchema,
  artworkMinimumFeeMinor: MinorAmountSchema,
  designHourlyRateMinor: MinorAmountSchema,
  rushFeePercent: z.number().min(0).max(5),
  oversizedSurchargePerLocationMinor: MinorAmountSchema,
  packingFeePerGarmentMinor: MinorAmountSchema,
  shippingMarkupPercent: z.number().min(0).max(5),
  roundGarmentCostUpToWholeDollar: z.boolean(),
  garmentCostCapForMarkupMinor: MinorAmountSchema,
});
export type PricingSettings = z.infer<typeof PricingSettingsSchema>;

export const PricingMultipliersSchema = z.object({
  screenPrint: z.number().positive(),
  darkGarmentPremium: z.number().positive(),
  embroidery: z.number().positive(),
  dtf: z.number().positive(),
  garmentMarkup: z.number().positive(),
});
export type PricingMultipliers = z.infer<typeof PricingMultipliersSchema>;

export const ScreenPrintMatrixSchema = z.object({
  qtyTiers: z.array(QtyTierSchema).min(1),
  /** Keys "1".."8"; each array aligns with qtyTiers, values in minor units. */
  pricesByColour: z.record(z.string(), z.array(MinorAmountSchema).min(1)),
});
export type ScreenPrintMatrix = z.infer<typeof ScreenPrintMatrixSchema>;

export const EmbroideryTierSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive().nullable(),
  baseTo5000Minor: MinorAmountSchema,
  extraPer1000Minor: MinorAmountSchema,
  digitizingFeeMinor: MinorAmountSchema,
});
export type EmbroideryTier = z.infer<typeof EmbroideryTierSchema>;

export const DtfTierSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive().nullable(),
  smallMinor: MinorAmountSchema,
  mediumMinor: MinorAmountSchema,
  largeMinor: MinorAmountSchema,
  oversizeMinor: MinorAmountSchema,
});
export type DtfTier = z.infer<typeof DtfTierSchema>;

export const GarmentMarkupSchema = z.object({
  mode: z.enum(["anchorGrid", "formula"]),
  /** Whole-dollar cost anchors in major units (e.g. 1, 5, 10). */
  costAnchors: z.array(z.number().positive()).min(2),
  qtyAnchors: z.array(z.number().int().positive()).min(2),
  /** rows = costAnchors, cols = qtyAnchors; unitless markup multipliers. */
  grid: z.array(z.array(z.number().positive()).min(2)).min(2),
});
export type GarmentMarkup = z.infer<typeof GarmentMarkupSchema>;

export const PricingConfigSchema = z.object({
  version: z.number().int().positive(),
  status: PricingConfigStatusSchema,
  effectiveFrom: z.string().optional(),
  settings: PricingSettingsSchema,
  multipliers: PricingMultipliersSchema,
  screenPrintMatrix: ScreenPrintMatrixSchema,
  embroideryTiers: z.array(EmbroideryTierSchema).min(1),
  dtfTiers: z.array(DtfTierSchema).min(1),
  garmentMarkup: GarmentMarkupSchema,
});
export type PricingConfig = z.infer<typeof PricingConfigSchema>;

export const DecorationMethodSchema = z.enum([
  "screenPrint",
  "embroidery",
  "dtf",
]);
export type DecorationMethod = z.infer<typeof DecorationMethodSchema>;

export const DtfSizeSchema = z.enum(["small", "medium", "large", "oversize"]);
export type DtfSize = z.infer<typeof DtfSizeSchema>;

export const DecorationLocationInputSchema = z.object({
  method: DecorationMethodSchema,
  location: z.string().min(1).max(100),
  colours: z.number().int().min(1).max(8).optional(),
  stitchCount: z.number().int().positive().optional(),
  size: DtfSizeSchema.optional(),
  isOversized: z.boolean().default(false),
  isRepeatArtwork: z.boolean().default(false),
});
export type DecorationLocationInput = z.infer<
  typeof DecorationLocationInputSchema
>;

export const QuoteInputSchema = z.object({
  quantity: z.number().int().positive(),
  garment: z.object({
    unitCostMinor: MinorAmountSchema,
    isDark: z.boolean().default(false),
  }),
  decorations: z.array(DecorationLocationInputSchema).max(20).default([]),
  options: z
    .object({
      rush: z.boolean().default(false),
      designHours: z.number().min(0).max(200).default(0),
      includePacking: z.boolean().default(false),
      shippingCostMinor: MinorAmountSchema.default(0),
    })
    .default({}),
  needsArtworkReview: z.boolean().default(false),
});
export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export const QuoteLineKindSchema = z.enum([
  "garment",
  "decoration",
  "setup",
  "digitizing",
  "artwork_minimum",
  "design",
  "packing",
  "shipping",
  "rush",
  "oversized",
]);
export type QuoteLineKind = z.infer<typeof QuoteLineKindSchema>;

export const QuoteBreakdownLineSchema = z.object({
  kind: QuoteLineKindSchema,
  label: z.string().min(1).max(200),
  quantity: z.number().int().nonnegative(),
  unitAmountMinor: z.number().int(),
  extendedAmountMinor: z.number().int(),
  meta: z.record(z.unknown()).optional(),
});
export type QuoteBreakdownLine = z.infer<typeof QuoteBreakdownLineSchema>;

export const QuoteBreakdownSchema = z.object({
  pricingConfigVersion: z.number().int().positive(),
  currency: z.literal("CAD").default("CAD"),
  quantity: z.number().int().positive(),
  garmentSellPerPieceMinor: MinorAmountSchema,
  decorationPerPieceMinor: MinorAmountSchema,
  perPieceMinor: MinorAmountSchema,
  oneTimeFeesMinor: MinorAmountSchema,
  packingMinor: MinorAmountSchema,
  shippingMinor: MinorAmountSchema,
  rushMinor: MinorAmountSchema,
  subtotalBeforeRushMinor: MinorAmountSchema,
  totalMinor: MinorAmountSchema,
  needsArtworkReview: z.boolean(),
  lines: z.array(QuoteBreakdownLineSchema).min(1),
});
export type QuoteBreakdown = z.infer<typeof QuoteBreakdownSchema>;

export const LinePricingSnapshotSchema = z.object({
  input: QuoteInputSchema,
  breakdown: QuoteBreakdownSchema,
  pricingConfigVersion: z.number().int().positive(),
});
export type LinePricingSnapshot = z.infer<typeof LinePricingSnapshotSchema>;

export const PublishedPricingConfigResponseSchema = z.object({
  id: CanonicalIdSchema,
  tenantId: CanonicalIdSchema,
  version: z.number().int().positive(),
  status: z.literal("published"),
  publishedAt: z.string().datetime().nullable(),
  config: PricingConfigSchema,
});
export type PublishedPricingConfigResponse = z.infer<
  typeof PublishedPricingConfigResponseSchema
>;

export const PricingConfigVersionSummarySchema = z.object({
  id: CanonicalIdSchema,
  version: z.number().int().positive(),
  status: PricingConfigStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PricingConfigVersionSummary = z.infer<
  typeof PricingConfigVersionSummarySchema
>;

export const PricingConfigDraftResponseSchema = z.object({
  id: CanonicalIdSchema,
  tenantId: CanonicalIdSchema,
  version: z.number().int().positive(),
  status: z.literal("draft"),
  config: PricingConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PricingConfigDraftResponse = z.infer<
  typeof PricingConfigDraftResponseSchema
>;

export const UpsertPricingConfigDraftSchema = z.object({
  context: RequestContextSchema,
  config: PricingConfigSchema,
});
export type UpsertPricingConfigDraft = z.infer<
  typeof UpsertPricingConfigDraftSchema
>;

export const PublishPricingConfigSchema = z.object({
  context: RequestContextSchema,
  source: SourceMetadataSchema.default({ system: "commerce_api" }),
});
export type PublishPricingConfig = z.infer<typeof PublishPricingConfigSchema>;

export const RestorePricingConfigDraftSchema = z.object({
  context: RequestContextSchema,
  version: z.number().int().positive(),
});
export type RestorePricingConfigDraft = z.infer<
  typeof RestorePricingConfigDraftSchema
>;

export const JobRequestLineInputSchema = z.object({
  productId: CanonicalIdSchema.optional(),
  styleId: CanonicalIdSchema.optional(),
  variantId: CanonicalIdSchema.optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPriceEstimateMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).toUpperCase().default("CAD"),
  configuration: z
    .object({
      pricing: LinePricingSnapshotSchema.optional(),
    })
    .passthrough()
    .default({}),
});
export type JobRequestLineInput = z.infer<typeof JobRequestLineInputSchema>;

export const CustomerContactSnapshotSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(50),
  company: z.string().max(200).optional(),
});
export type CustomerContactSnapshot = z.infer<
  typeof CustomerContactSnapshotSchema
>;

export const FulfillmentSnapshotSchema = z.object({
  method: z.enum(["standard", "priority", "rush", "pickup"]),
  address: z.object({
    address1: z.string().min(3).max(200),
    address2: z.string().max(200).optional(),
    city: z.string().min(2).max(100),
    region: z.string().min(2).max(100),
    postalCode: z.string().min(3).max(20),
    country: z.string().min(2).max(100),
  }),
  deliveryNotes: z.string().max(1_000).optional(),
});
export type FulfillmentSnapshot = z.infer<typeof FulfillmentSnapshotSchema>;

export const CreateJobRequestSchema = z.object({
  context: RequestContextSchema,
  customerPersonId: CanonicalIdSchema,
  customerNote: z.string().max(4_000).optional(),
  contact: CustomerContactSnapshotSchema,
  fulfillment: FulfillmentSnapshotSchema,
  lines: z.array(JobRequestLineInputSchema).min(1).max(200),
  source: SourceMetadataSchema.default({ system: "storefront" }),
});
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const SubmitJobRequestSchema = z.object({
  context: RequestContextSchema,
  source: SourceMetadataSchema.default({ system: "storefront" }),
});
export type SubmitJobRequest = z.infer<typeof SubmitJobRequestSchema>;

export const TransitionJobRequestSchema = z.object({
  context: RequestContextSchema,
  toStatus: JobRequestStatusSchema,
  reason: z.string().min(1).max(1_000).optional(),
  source: SourceMetadataSchema.default({ system: "commerce_api" }),
});
export type TransitionJobRequest = z.infer<typeof TransitionJobRequestSchema>;

export const StatusHistoryEntrySchema = z.object({
  id: CanonicalIdSchema,
  fromStatus: JobRequestStatusSchema.nullable(),
  toStatus: JobRequestStatusSchema,
  reason: z.string().nullable(),
  actor: ActorSchema,
  source: SourceMetadataSchema,
  occurredAt: z.string().datetime(),
});
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;

export const JobDisplayIdSchema = z
  .string()
  .regex(/^GWG-\d{4,}$/, "Expected a job reference like GWG-1001");
export type JobDisplayId = z.infer<typeof JobDisplayIdSchema>;

function withDisplayId<T extends { id: string; displayId?: string }>(
  row: T,
): T & { displayId: string } {
  const displayId =
    row.displayId && /^GWG-\d{4,}$/.test(row.displayId)
      ? row.displayId
      : `GWG-${row.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
  return { ...row, displayId };
}

/** Wire shape before displayId normalization. Older API builds omit displayId. */
const JobRequestResponseObjectSchema = z.object({
  id: CanonicalIdSchema,
  displayId: z.string().min(1).max(64).optional(),
  context: RequestContextSchema,
  customerPersonId: CanonicalIdSchema,
  status: JobRequestStatusSchema,
  version: z.number().int().positive(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const JobRequestResponseSchema =
  JobRequestResponseObjectSchema.transform(withDisplayId);
export type JobRequestResponse = z.infer<typeof JobRequestResponseSchema>;

export const FinalQuoteResponseSchema = z.object({
  id: CanonicalIdSchema,
  jobRequestId: CanonicalIdSchema,
  version: z.number().int().positive(),
  amountMinor: MinorAmountSchema,
  currency: z.string().length(3).toUpperCase(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type FinalQuoteResponse = z.infer<typeof FinalQuoteResponseSchema>;

export const ProofVersionResponseSchema = z.object({
  id: CanonicalIdSchema,
  jobRequestId: CanonicalIdSchema,
  version: z.number().int().positive(),
  storageKey: z.string().min(1).max(2_000),
  decision: z.enum(["pending", "approved", "changes_requested"]).nullable(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ProofVersionResponse = z.infer<typeof ProofVersionResponseSchema>;

export const CreateFinalQuoteSchema = z.object({
  context: RequestContextSchema,
  amountMinor: MinorAmountSchema,
  currency: z.string().length(3).toUpperCase().default("CAD"),
  note: z.string().max(2_000).optional(),
  markAwaitingPayment: z.boolean().default(false),
  source: SourceMetadataSchema.default({ system: "commerce_api" }),
});
export type CreateFinalQuote = z.infer<typeof CreateFinalQuoteSchema>;

export const CreateProofVersionSchema = z.object({
  context: RequestContextSchema,
  storageKey: z.string().min(1).max(2_000),
  note: z.string().max(2_000).optional(),
  source: SourceMetadataSchema.default({ system: "commerce_api" }),
});
export type CreateProofVersion = z.infer<typeof CreateProofVersionSchema>;

export const JobRequestDetailResponseSchema = JobRequestResponseObjectSchema.extend({
  lines: z.array(
    z.object({
      id: CanonicalIdSchema,
      position: z.number().int().nonnegative(),
      snapshot: JobRequestLineInputSchema,
    }),
  ),
  timeline: z.array(StatusHistoryEntrySchema),
  finalQuotes: z.array(FinalQuoteResponseSchema).default([]),
  proofs: z.array(ProofVersionResponseSchema).default([]),
}).transform(withDisplayId);
export type JobRequestDetailResponse = z.infer<
  typeof JobRequestDetailResponseSchema
>;

export const JobRequestListResponseSchema = z.array(JobRequestResponseSchema);
export type JobRequestListResponse = z.infer<
  typeof JobRequestListResponseSchema
>;

export const StorefrontJobSubmissionSchema = z.object({
  idempotencyKey: IdempotencyKeySchema,
  contact: CustomerContactSnapshotSchema,
  fulfillment: FulfillmentSnapshotSchema,
  customerNote: z.string().max(4_000).optional(),
  lines: z.array(JobRequestLineInputSchema).min(1).max(200),
});
export type StorefrontJobSubmission = z.infer<
  typeof StorefrontJobSubmissionSchema
>;

export const CommerceErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
export type CommerceErrorResponse = z.infer<
  typeof CommerceErrorResponseSchema
>;

export const CommerceEventTypes = [
  "commerce.job_request.created.v1",
  "commerce.job_request.submitted.v1",
  "commerce.job_request.status_changed.v1",
  "commerce.job_request.final_quote.created.v1",
  "commerce.job_request.proof.created.v1",
  "commerce.contact_request.received.v1",
] as const;
export const CommerceEventTypeSchema = z.enum(CommerceEventTypes);
export type CommerceEventType = z.infer<typeof CommerceEventTypeSchema>;

export const CommerceEventEnvelopeSchema = z.object({
  id: CanonicalIdSchema,
  type: CommerceEventTypeSchema,
  version: z.literal(1),
  aggregateId: CanonicalIdSchema,
  tenantId: CanonicalIdSchema,
  accountId: CanonicalIdSchema,
  occurredAt: z.string().datetime(),
  actor: ActorSchema,
  source: SourceMetadataSchema,
  data: z.record(z.unknown()),
});
export type CommerceEventEnvelope = z.infer<
  typeof CommerceEventEnvelopeSchema
>;

export interface AuthContext {
  tenantId: CanonicalId;
  accountId: CanonicalId;
  storeId: CanonicalId;
  actor: Actor;
}

export interface AuthContextPort<TRequest = unknown> {
  resolve(request: TRequest): Promise<AuthContext>;
}

export interface EventPublisherPort {
  publish(event: CommerceEventEnvelope): Promise<void>;
}

export interface CodCrmPort {
  sendJobRequest(event: CommerceEventEnvelope): Promise<void>;
}

export interface EmailPort {
  send(template: string, recipient: string, data: unknown): Promise<void>;
}

export interface StripePort {
  createCheckoutSession(input: {
    jobRequestId: CanonicalId;
    amountMinor: number;
    currency: string;
  }): Promise<{ externalSessionId: string; url: string }>;
}

export interface VendorCatalogPort {
  fetchChangedProducts(cursor?: string): Promise<{
    items: unknown[];
    nextCursor?: string;
  }>;
}
