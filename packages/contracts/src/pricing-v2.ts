import { z } from "zod";

/**
 * Pricing config v2 — decoration methods are data, not code.
 *
 * v1 (see index.ts) hard-codes screenPrintMatrix / embroideryTiers / dtfTiers,
 * so adding a method like leather patches or sublimation means a schema change,
 * a new branch in the engine, and a deploy. v2 stores methods as a list of
 * records with a rate model, so a new method is an admin task.
 *
 * Every amount ending in `Minor` is CAD cents.
 */

const MinorAmount = z.number().int().nonnegative();
const Multiplier = z.number().positive().max(100);
const Percent = z.number().min(0).max(5);

export const PricingConfigStatusV2Schema = z.enum([
  "draft",
  "published",
  "archived",
]);

/** Ascending quantity breakpoints, e.g. [1, 6, 12, 24, 48, 72, 144, 288]. */
const QtyAnchors = z.array(z.number().int().positive()).min(2);

/**
 * Rate lookup shapes. Between two anchors the rate is interpolated linearly;
 * at or above the top anchor it stays flat.
 */
export const RateModelSchema = z.discriminatedUnion("kind", [
  /** Screen print: a rate per colour count per quantity. */
  z.object({
    kind: z.literal("matrixByColour"),
    qtyAnchors: QtyAnchors,
    minColours: z.number().int().positive(),
    maxColours: z.number().int().positive(),
    /** Keys are colour counts as strings; each array aligns with qtyAnchors. */
    ratesByColour: z.record(z.string(), z.array(MinorAmount).min(2)),
  }),
  /**
   * Embroidery: a base rate covering `includedUnits` of some measure, plus a
   * per-unit rate for everything above it. Both rates interpolate by quantity.
   */
  z.object({
    kind: z.literal("baseWithVariable"),
    qtyAnchors: QtyAnchors,
    baseMinor: z.array(MinorAmount).min(2),
    extraPerUnitMinor: z.array(MinorAmount).min(2),
    variable: z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      unitSize: z.number().positive(),
      includedUnits: z.number().nonnegative(),
      /** false bills partial units (7,500 stitches = 2.5 units). */
      roundUpPartialUnits: z.boolean(),
    }),
  }),
  /** DTF, patches, HTV: a rate per size/complexity option per quantity. */
  z.object({
    kind: z.literal("matrixByOption"),
    qtyAnchors: QtyAnchors,
    options: z
      .array(z.object({ key: z.string().min(1), label: z.string().min(1) }))
      .min(1),
    ratesByOption: z.record(z.string(), z.array(MinorAmount).min(2)),
  }),
  /** Simplest case: one rate per quantity, no variants. */
  z.object({
    kind: z.literal("flatByQty"),
    qtyAnchors: QtyAnchors,
    ratesMinor: z.array(MinorAmount).min(2),
  }),
]);
export type RateModel = z.infer<typeof RateModelSchema>;

export const SurchargeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(""),
  kind: z.enum(["percent", "flatPerPiece"]),
  /** Decimal fraction for percent (0.1 = +10%), cents for flatPerPiece. */
  value: z.number().nonnegative(),
  appliesWhen: z.enum(["garmentIsDark", "locationFlagged", "always"]),
  enabled: z.boolean().default(true),
});
export type Surcharge = z.infer<typeof SurchargeSchema>;

export const SetupFrequencySchema = z.enum(["perJob", "perCustomer", "once"]);
export type SetupFrequency = z.infer<typeof SetupFrequencySchema>;

export const MethodSetupSchema = z.object({
  label: z.string().min(1),
  description: z.string().default(""),
  newFeeMinor: MinorAmount,
  repeatFeeMinor: MinorAmount,
  /** What the fee is charged per: colour count, whole design, or location. */
  per: z.enum(["colour", "design", "location"]),
  /**
   * How often the fee is collected.
   * perJob — every order (screen burn).
   * perCustomer — first time this customer uses the artwork (digitizing).
   * once — first time this artwork is set up, ever.
   */
  frequency: SetupFrequencySchema.default("perJob"),
  /**
   * When true the fee is charged once per logo group and split across the
   * garments using it, pro-rata by quantity (matches the estimator workbook).
   */
  shareAcrossGarments: z.boolean().default(true),
  /** Digitizing is a pass-through cost, so the run multiplier must not hit it. */
  multiplierApplies: z.boolean().default(false),
  /** Customers may claim repeat artwork; staff confirm before it's honoured. */
  repeatRequiresVerification: z.boolean().default(true),
});
export type MethodSetup = z.infer<typeof MethodSetupSchema>;

export const ThreadFeeSchema = z.object({
  enabled: z.boolean().default(false),
  label: z.string().min(1).default("Thread fee"),
  description: z.string().default(""),
  kind: z.enum(["flatPerJob", "flatPerPiece"]).default("flatPerJob"),
  amountMinor: MinorAmount.default(0),
  multiplierApplies: z.boolean().default(false),
});
export type ThreadFee = z.infer<typeof ThreadFeeSchema>;

export const DecorationMethodConfigSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(80),
  description: z.string().default(""),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
  multiplier: Multiplier,
  rateModel: RateModelSchema,
  setup: MethodSetupSchema,
  threadFee: ThreadFeeSchema.default({
    enabled: false,
    label: "Thread fee",
    description: "",
    kind: "flatPerJob",
    amountMinor: 0,
    multiplierApplies: false,
  }),
  /** Floor on the run charge for one location, before surcharges. */
  minimumChargePerLocationMinor: MinorAmount.default(0),
  surcharges: z.array(SurchargeSchema).default([]),
  /** Internal cost ratios, used for margin display only. */
  costModel: z
    .object({
      runCostRatio: z.number().min(0).max(1),
      setupCostRatio: z.number().min(0).max(1),
    })
    .default({ runCostRatio: 0.4, setupCostRatio: 0.2 }),
});
export type DecorationMethodConfig = z.infer<
  typeof DecorationMethodConfigSchema
>;

export const GarmentPricingSchema = z.object({
  multiplier: Multiplier,
  roundCostUpToWholeDollar: z.boolean().default(true),
  costCapForMarkupMinor: MinorAmount,
  markupGrid: z.object({
    /** Whole-dollar cost rows, e.g. 1..150. Rows are exact, not interpolated. */
    costAnchors: z.array(z.number().positive()).min(2),
    qtyAnchors: QtyAnchors,
    /** rows = costAnchors, cols = qtyAnchors. Unitless markup multipliers. */
    grid: z.array(z.array(z.number().positive()).min(2)).min(2),
  }),
  /** What to do when a vendor supplies a MAP (minimum advertised price). */
  mapPolicy: z.enum(["ignore", "floor", "warnOnly"]).default("warnOnly"),
  /** Quantity the storefront "from" price on a catalog tile assumes. */
  catalogDisplayQty: z.number().int().positive().default(24),
});
export type GarmentPricing = z.infer<typeof GarmentPricingSchema>;

export const PricingSettingsV2Schema = z.object({
  currency: z.literal("CAD").default("CAD"),
  minimumOrderQty: z.number().int().positive(),
  rushFeePercent: Percent,
  /** Client rule: rush never applies to freight. */
  rushAppliesTo: z
    .enum(["productionExcludingShipping", "everything"])
    .default("productionExcludingShipping"),
  packingFeePerGarmentMinor: MinorAmount,
  shippingMarkupPercent: Percent,
  quoteValidityDays: z.number().int().positive().default(30),
  artworkMinimumFeeMinor: MinorAmount.default(0),
  designHourlyRateMinor: MinorAmount.default(0),
  /** Every colour except white counts as dark, to keep quoting simple. */
  darkGarmentRule: z.enum(["everythingExceptWhite", "explicit"]).default(
    "everythingExceptWhite",
  ),
  /** Warn staff when a quote's gross margin falls below this fraction. */
  marginWarningThreshold: z.number().min(0).max(1).default(0.35),
});
export type PricingSettingsV2 = z.infer<typeof PricingSettingsV2Schema>;

/**
 * How the storefront turns the same quote math into a shopper-facing unit
 * price. Admin picks the strategy; PDP, studio, quote and cart all call the
 * same helper with this block.
 */
export const StorefrontPricingSchema = z.object({
  /**
   * blank — garment only.
   * decorated — garment + run + per-piece thread (setup stays off the unit).
   * landed — decorated plus amortized setup and per-job thread.
   */
  unitPriceIncludes: z
    .enum(["blank", "decorated", "landed"])
    .default("blank"),
  defaultMethodKey: z.string().min(1).default("screenPrint"),
  defaultLocation: z.string().min(1).default("front"),
  defaultColours: z.number().int().positive().max(12).default(1),
  defaultStitchCount: z.number().nonnegative().default(5000),
  defaultOptionKey: z.string().min(1).default("medium"),
  assumeNewArtwork: z.boolean().default(true),
  assumeDarkGarment: z.boolean().default(false),
});
export type StorefrontPricing = z.infer<typeof StorefrontPricingSchema>;

export const PricingConfigV2Schema = z.object({
  schemaVersion: z.literal(2),
  version: z.number().int().positive(),
  status: PricingConfigStatusV2Schema,
  effectiveFrom: z.string().optional(),
  notes: z.string().default(""),
  settings: PricingSettingsV2Schema,
  garment: GarmentPricingSchema,
  methods: z.array(DecorationMethodConfigSchema).min(1),
  storefront: StorefrontPricingSchema.default({
    unitPriceIncludes: "blank",
    defaultMethodKey: "screenPrint",
    defaultLocation: "front",
    defaultColours: 1,
    defaultStitchCount: 5000,
    defaultOptionKey: "medium",
    assumeNewArtwork: true,
    assumeDarkGarment: false,
  }),
});
export type PricingConfigV2 = z.infer<typeof PricingConfigV2Schema>;

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */

const ScopeContext = z.object({
  tenantId: z.string().uuid(),
  accountId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
});

export const PricingConfigV2DraftResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.literal("draft"),
  config: PricingConfigV2Schema,
  publishedVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PricingConfigV2DraftResponse = z.infer<
  typeof PricingConfigV2DraftResponseSchema
>;

export const PublishedPricingConfigV2ResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.literal("published"),
  publishedAt: z.string().nullable(),
  config: PricingConfigV2Schema,
});
export type PublishedPricingConfigV2Response = z.infer<
  typeof PublishedPricingConfigV2ResponseSchema
>;

export const UpsertPricingConfigV2DraftSchema = z.object({
  context: ScopeContext,
  config: PricingConfigV2Schema,
});
export type UpsertPricingConfigV2Draft = z.infer<
  typeof UpsertPricingConfigV2DraftSchema
>;

// Declared here rather than imported from index.ts, which re-exports this file.
const SourceMetadata = z.object({
  system: z.enum([
    "vendor",
    "storefront",
    "commerce_api",
    "codcrm",
    "codchat",
    "stripe",
  ]),
  externalId: z.string().min(1).max(255).optional(),
  correlationId: z.string().min(1).max(255).optional(),
});

export const PublishPricingConfigV2Schema = z.object({
  context: ScopeContext,
  notes: z.string().max(500).default(""),
  source: SourceMetadata.default({ system: "commerce_api" }),
});
export type PublishPricingConfigV2 = z.infer<
  typeof PublishPricingConfigV2Schema
>;

export const RestorePricingConfigV2DraftSchema = z.object({
  context: ScopeContext,
  version: z.number().int().positive(),
});
export type RestorePricingConfigV2Draft = z.infer<
  typeof RestorePricingConfigV2DraftSchema
>;

/**
 * Which stored config a preview should price against. "inline" lets the admin
 * calculator price unsaved editor state, so staff can see the effect of a
 * change before committing it to the draft.
 */
export const PricingConfigSelectorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("draft") }),
  z.object({ kind: z.literal("published") }),
  z.object({
    kind: z.literal("version"),
    version: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("inline"), config: PricingConfigV2Schema }),
]);
export type PricingConfigSelector = z.infer<typeof PricingConfigSelectorSchema>;

export const PricingConfigV2VersionSummarySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: PricingConfigStatusV2Schema,
  notes: z.string(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PricingConfigV2VersionSummary = z.infer<
  typeof PricingConfigV2VersionSummarySchema
>;

/* ------------------------------------------------------------------ */
/* Quote input                                                         */
/* ------------------------------------------------------------------ */

export const ArtworkStatusSchema = z.object({
  /** What the customer claims. Never trusted on its own. */
  isRepeat: z.boolean().default(false),
  /** Set by staff. Repeat pricing only applies once this is true. */
  verifiedByStaff: z.boolean().default(false),
  verifiedBy: z.string().max(200).optional(),
  verifiedAt: z.string().optional(),
});
export type ArtworkStatus = z.infer<typeof ArtworkStatusSchema>;

export const QuoteGarmentLineSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().max(200).default(""),
  unitCostMinor: MinorAmount,
  quantity: z.number().int().positive(),
  colourName: z.string().max(80).default(""),
  /** Optional override; otherwise derived from colourName by the dark rule. */
  isDark: z.boolean().optional(),
  /** Vendor MAP when supplied, for mapPolicy handling. */
  mapPriceMinor: MinorAmount.optional(),
  /** Staff override of the calculated sell price per piece. */
  overrideSellPerPieceMinor: MinorAmount.optional(),
  overrideReason: z.string().max(300).optional(),
});
export type QuoteGarmentLine = z.infer<typeof QuoteGarmentLineSchema>;

export const QuoteDecorationLineSchema = z.object({
  id: z.string().min(1).max(64),
  garmentId: z.string().min(1).max(64),
  methodKey: z.string().min(1).max(50),
  location: z.string().min(1).max(100),
  /**
   * Locations sharing a logo group pay one setup fee between them, split
   * pro-rata by quantity. Blank means this location stands alone.
   */
  logoGroup: z.string().max(100).default(""),
  colours: z.number().int().positive().max(12).optional(),
  /** Value for a baseWithVariable model, e.g. stitch count. */
  variableValue: z.number().nonnegative().optional(),
  /** Option key for a matrixByOption model, e.g. "medium". */
  optionKey: z.string().max(50).optional(),
  isOversized: z.boolean().default(false),
  artwork: ArtworkStatusSchema.default({
    isRepeat: false,
    verifiedByStaff: false,
  }),
  overrideUnitAmountMinor: MinorAmount.optional(),
  overrideReason: z.string().max(300).optional(),
});
export type QuoteDecorationLine = z.infer<typeof QuoteDecorationLineSchema>;

export const QuoteOptionsV2Schema = z.object({
  rush: z.boolean().default(false),
  includePacking: z.boolean().default(false),
  shippingCostMinor: MinorAmount.default(0),
  designHours: z.number().nonnegative().default(0),
  overrideShippingMinor: MinorAmount.optional(),
  overrideRushMinor: MinorAmount.optional(),
  overrideTotalMinor: MinorAmount.optional(),
  overrideReason: z.string().max(300).optional(),
});
export type QuoteOptionsV2 = z.infer<typeof QuoteOptionsV2Schema>;

export const QuoteInputV2Schema = z.object({
  garments: z.array(QuoteGarmentLineSchema).min(1).max(50),
  decorations: z.array(QuoteDecorationLineSchema).max(200).default([]),
  options: QuoteOptionsV2Schema.default({
    rush: false,
    includePacking: false,
    shippingCostMinor: 0,
    designHours: 0,
  }),
});
export type QuoteInputV2 = z.infer<typeof QuoteInputV2Schema>;

/* ------------------------------------------------------------------ */
/* Breakdown + explanation                                             */
/* ------------------------------------------------------------------ */

/**
 * Explanations are produced by the engine, never re-derived in the UI, so the
 * math a staff member reads can't drift from the amount they're charging.
 */
export const ExplainStepSchema = z.object({
  label: z.string(),
  detail: z.string(),
  result: z.string().optional(),
});
export type ExplainStep = z.infer<typeof ExplainStepSchema>;

export const ExplainSourceSchema = z.object({
  label: z.string(),
  /** Dotted path into the pricing config, for deep-linking the admin editor. */
  path: z.string(),
  value: z.string(),
});
export type ExplainSource = z.infer<typeof ExplainSourceSchema>;

export const ExplainSchema = z.object({
  plainEnglish: z.string(),
  steps: z.array(ExplainStepSchema),
  sources: z.array(ExplainSourceSchema),
});
export type Explain = z.infer<typeof ExplainSchema>;

export const QuoteLineKindSchema = z.enum([
  "garment",
  "decoration",
  "surcharge",
  "setup",
  "thread",
  "design",
  "artworkMinimum",
  "packing",
  "shipping",
  "rush",
]);
export type QuoteLineKind = z.infer<typeof QuoteLineKindSchema>;

export const QuoteLineV2Schema = z.object({
  id: z.string(),
  kind: QuoteLineKindSchema,
  garmentId: z.string().optional(),
  decorationId: z.string().optional(),
  label: z.string(),
  quantity: z.number(),
  unitAmountMinor: z.number(),
  extendedAmountMinor: z.number().int(),
  /** Estimated internal cost, for margin display. */
  costMinor: z.number().int().default(0),
  isOverride: z.boolean().default(false),
  explain: ExplainSchema,
});
export type QuoteLineV2 = z.infer<typeof QuoteLineV2Schema>;

export const QuoteTotalsV2Schema = z.object({
  merchandiseMinor: z.number().int(),
  decorationMinor: z.number().int(),
  setupMinor: z.number().int(),
  threadMinor: z.number().int().default(0),
  packingMinor: z.number().int(),
  shippingMinor: z.number().int(),
  rushMinor: z.number().int(),
  /** Rush base: everything except shipping, under the default setting. */
  productionSubtotalMinor: z.number().int(),
  subtotalBeforeRushMinor: z.number().int(),
  totalMinor: z.number().int(),
  estimatedCostMinor: z.number().int(),
  grossProfitMinor: z.number().int(),
  grossMarginPercent: z.number(),
});
export type QuoteTotalsV2 = z.infer<typeof QuoteTotalsV2Schema>;

export const QuoteBreakdownV2Schema = z.object({
  pricingConfigVersion: z.number().int(),
  currency: z.literal("CAD"),
  totalQuantity: z.number().int(),
  garments: z.array(
    z.object({
      garmentId: z.string(),
      quantity: z.number().int(),
      unitCostMinor: z.number().int(),
      sellPerPieceMinor: z.number().int(),
      decorationPerPieceMinor: z.number().int(),
      unitPriceMinor: z.number().int(),
      extendedMinor: z.number().int(),
    }),
  ),
  lines: z.array(QuoteLineV2Schema),
  totals: QuoteTotalsV2Schema,
  warnings: z.array(z.string()),
  /** Requires staff review before the quote can be sent. */
  needsArtworkVerification: z.boolean(),
  expiresInDays: z.number().int(),
});
export type QuoteBreakdownV2 = z.infer<typeof QuoteBreakdownV2Schema>;

/**
 * Travels with a cart line so the server can re-price it against the config
 * that is live at submission time, rather than trusting a price the browser
 * calculated minutes or days earlier. `schemaVersion` is what distinguishes
 * it from a v1 snapshot on the same field.
 */
export const LinePricingSnapshotV2Schema = z.object({
  schemaVersion: z.literal(2),
  input: QuoteInputV2Schema,
  breakdown: QuoteBreakdownV2Schema,
  pricingConfigVersion: z.number().int().positive(),
});
export type LinePricingSnapshotV2 = z.infer<typeof LinePricingSnapshotV2Schema>;

/* ------------------------------------------------------------------ */
/* Admin calculator                                                    */
/* ------------------------------------------------------------------ */

export const PreviewQuoteV2Schema = z.object({
  context: ScopeContext,
  using: PricingConfigSelectorSchema.default({ kind: "draft" }),
  /** When set, the same quote is priced twice so staff can see the delta. */
  compareWith: PricingConfigSelectorSchema.optional(),
  quote: QuoteInputV2Schema,
});
export type PreviewQuoteV2 = z.infer<typeof PreviewQuoteV2Schema>;

export const QuotePreviewResultSchema = z.object({
  label: z.string(),
  configVersion: z.number().int(),
  configStatus: PricingConfigStatusV2Schema,
  breakdown: QuoteBreakdownV2Schema,
});
export type QuotePreviewResult = z.infer<typeof QuotePreviewResultSchema>;

export const QuotePreviewDifferenceSchema = z.object({
  label: z.string(),
  usingMinor: z.number().int(),
  comparisonMinor: z.number().int(),
  deltaMinor: z.number().int(),
});
export type QuotePreviewDifference = z.infer<
  typeof QuotePreviewDifferenceSchema
>;

export const PreviewQuoteV2ResponseSchema = z.object({
  using: QuotePreviewResultSchema,
  comparison: QuotePreviewResultSchema.nullable(),
  differences: z.array(QuotePreviewDifferenceSchema),
});
export type PreviewQuoteV2Response = z.infer<
  typeof PreviewQuoteV2ResponseSchema
>;
