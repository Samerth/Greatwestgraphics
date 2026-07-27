import { z } from "zod";

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

export const JobRequestLineInputSchema = z.object({
  productId: CanonicalIdSchema.optional(),
  styleId: CanonicalIdSchema.optional(),
  variantId: CanonicalIdSchema.optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPriceEstimateMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).toUpperCase().default("CAD"),
  configuration: z.record(z.unknown()).default({}),
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

export const JobRequestResponseSchema = z.object({
  id: CanonicalIdSchema,
  context: RequestContextSchema,
  customerPersonId: CanonicalIdSchema,
  status: JobRequestStatusSchema,
  version: z.number().int().positive(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type JobRequestResponse = z.infer<typeof JobRequestResponseSchema>;

export const JobRequestDetailResponseSchema = JobRequestResponseSchema.extend({
  lines: z.array(
    z.object({
      id: CanonicalIdSchema,
      position: z.number().int().nonnegative(),
      snapshot: JobRequestLineInputSchema,
    }),
  ),
  timeline: z.array(StatusHistoryEntrySchema),
});
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
