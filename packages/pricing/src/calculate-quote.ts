import {
  QuoteInputSchema,
  type DecorationLocationInput,
  type PricingConfig,
  type QuoteBreakdown,
  type QuoteBreakdownLine,
  type QuoteInput,
} from "@gwg/contracts";

export class PricingValidationError extends Error {
  readonly code = "PRICING_VALIDATION_ERROR";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round half away from zero for positive money amounts (cents). */
function roundMinor(value: number): number {
  return Math.floor(value + 0.5 + 1e-6);
}

function applyMultiplier(amountMinor: number, multiplier: number): number {
  const scaled = Math.round(multiplier * 1_000_000);
  return Math.floor((amountMinor * scaled) / 1_000_000 + 0.5);
}

function findTierIndex(
  tiers: Array<{ min: number; max: number | null }>,
  quantity: number,
): number {
  const index = tiers.findIndex(
    (tier) =>
      quantity >= tier.min && (tier.max === null || quantity <= tier.max),
  );
  if (index < 0) {
    throw new PricingValidationError(
      `No quantity tier found for quantity ${quantity}`,
    );
  }
  return index;
}

/**
 * Bilinear interpolation over the garment markup anchor grid.
 * Cost axis uses whole-dollar anchors; qty axis uses qty anchors.
 */
export function interpolateGarmentMarkup(
  garmentMarkup: PricingConfig["garmentMarkup"],
  costDollars: number,
  quantity: number,
): number {
  const { costAnchors, qtyAnchors, grid } = garmentMarkup;
  if (
    grid.length !== costAnchors.length ||
    grid.some((row) => row.length !== qtyAnchors.length)
  ) {
    throw new PricingValidationError(
      "Garment markup grid dimensions must match cost and qty anchors",
    );
  }

  const cost = Math.min(
    Math.max(costDollars, costAnchors[0]!),
    costAnchors[costAnchors.length - 1]!,
  );
  const qty = Math.min(
    Math.max(quantity, qtyAnchors[0]!),
    qtyAnchors[qtyAnchors.length - 1]!,
  );

  let c1 = 0;
  while (c1 < costAnchors.length - 1 && costAnchors[c1 + 1]! <= cost) c1 += 1;
  const c2 = Math.min(c1 + 1, costAnchors.length - 1);

  let q1 = 0;
  while (q1 < qtyAnchors.length - 1 && qtyAnchors[q1 + 1]! <= qty) q1 += 1;
  const q2 = Math.min(q1 + 1, qtyAnchors.length - 1);

  const costLow = costAnchors[c1]!;
  const costHigh = costAnchors[c2]!;
  const qtyLow = qtyAnchors[q1]!;
  const qtyHigh = qtyAnchors[q2]!;

  const tCost =
    costHigh === costLow ? 0 : (cost - costLow) / (costHigh - costLow);
  const tQty = qtyHigh === qtyLow ? 0 : (qty - qtyLow) / (qtyHigh - qtyLow);

  const v11 = grid[c1]![q1]!;
  const v12 = grid[c1]![q2]!;
  const v21 = grid[c2]![q1]!;
  const v22 = grid[c2]![q2]!;

  const top = v11 + (v12 - v11) * tQty;
  const bottom = v21 + (v22 - v21) * tQty;
  return round2(top + (bottom - top) * tCost);
}

function lookupCostDollarsForMarkup(
  unitCostMinor: number,
  settings: PricingConfig["settings"],
): number {
  const dollars = unitCostMinor / 100;
  const ceiled = settings.roundGarmentCostUpToWholeDollar
    ? Math.ceil(dollars)
    : dollars;
  const capDollars = settings.garmentCostCapForMarkupMinor / 100;
  return Math.min(ceiled, capDollars);
}

function screenPrintPerPiece(
  decoration: DecorationLocationInput,
  quantity: number,
  config: PricingConfig,
  isDark: boolean,
): number {
  if (decoration.colours == null) {
    throw new PricingValidationError(
      "Screen print locations require a colour count (1–8)",
    );
  }
  const tierIndex = findTierIndex(
    config.screenPrintMatrix.qtyTiers,
    quantity,
  );
  const prices = config.screenPrintMatrix.pricesByColour[String(decoration.colours)];
  if (!prices || prices[tierIndex] == null) {
    throw new PricingValidationError(
      `Missing screen print price for ${decoration.colours} colour(s)`,
    );
  }
  let amount = applyMultiplier(
    prices[tierIndex]!,
    config.multipliers.screenPrint,
  );
  if (isDark) {
    amount = applyMultiplier(amount, config.multipliers.darkGarmentPremium);
  }
  return amount;
}

function embroideryPerPiece(
  decoration: DecorationLocationInput,
  quantity: number,
  config: PricingConfig,
): number {
  if (decoration.stitchCount == null) {
    throw new PricingValidationError(
      "Embroidery locations require a stitch count",
    );
  }
  const tier =
    config.embroideryTiers[
      findTierIndex(config.embroideryTiers, quantity)
    ]!;
  const extraThousands = Math.max(
    0,
    Math.ceil((decoration.stitchCount - 5000) / 1000),
  );
  const amount = applyMultiplier(
    tier.baseTo5000Minor + extraThousands * tier.extraPer1000Minor,
    config.multipliers.embroidery,
  );
  return amount;
}

function dtfPerPiece(
  decoration: DecorationLocationInput,
  quantity: number,
  config: PricingConfig,
): number {
  if (decoration.size == null) {
    throw new PricingValidationError("DTF locations require a size");
  }
  const tier = config.dtfTiers[findTierIndex(config.dtfTiers, quantity)]!;
  const bySize = {
    small: tier.smallMinor,
    medium: tier.mediumMinor,
    large: tier.largeMinor,
    oversize: tier.oversizeMinor,
  }[decoration.size];
  return applyMultiplier(bySize, config.multipliers.dtf);
}

function decorationPerPiece(
  decoration: DecorationLocationInput,
  quantity: number,
  config: PricingConfig,
  isDark: boolean,
): number {
  switch (decoration.method) {
    case "screenPrint":
      return screenPrintPerPiece(decoration, quantity, config, isDark);
    case "embroidery":
      return embroideryPerPiece(decoration, quantity, config);
    case "dtf":
      return dtfPerPiece(decoration, quantity, config);
    default: {
      const _exhaustive: never = decoration.method;
      throw new PricingValidationError(`Unknown method: ${_exhaustive}`);
    }
  }
}

/**
 * Provisional open-question decisions (record before changing):
 * 1. Artwork minimum applies once when there is new artwork, designHours=0,
 *    and no setup/digitizing fees were charged (so Test A stays correct).
 * 2. Rush applies to the full subtotal including shipping and one-time fees.
 * 3. Dark garment premium applies to screen print only.
 * 4. Blank garment orders (no decorations) are allowed.
 * 5. No per-method minimums beyond settings.minimumOrderQty in v1.
 */
export function calculateQuote(
  rawInput: QuoteInput,
  config: PricingConfig,
): QuoteBreakdown {
  const input = QuoteInputSchema.parse(rawInput);
  const { quantity, garment, decorations, options } = input;

  if (quantity < config.settings.minimumOrderQty) {
    throw new PricingValidationError(
      `Quantity must be at least ${config.settings.minimumOrderQty}`,
    );
  }

  const lookupCost = lookupCostDollarsForMarkup(
    garment.unitCostMinor,
    config.settings,
  );
  const markup =
    interpolateGarmentMarkup(config.garmentMarkup, lookupCost, quantity) *
    config.multipliers.garmentMarkup;
  const roundedMarkup = round2(markup);
  const garmentSellPerPieceMinor = roundMinor(
    garment.unitCostMinor * roundedMarkup,
  );

  const lines: QuoteBreakdownLine[] = [
    {
      kind: "garment",
      label: "Garment",
      quantity,
      unitAmountMinor: garmentSellPerPieceMinor,
      extendedAmountMinor: garmentSellPerPieceMinor * quantity,
      meta: {
        unitCostMinor: garment.unitCostMinor,
        lookupCostDollars: lookupCost,
        markup: roundedMarkup,
      },
    },
  ];

  let decorationPerPieceMinor = 0;
  let oneTimeFeesMinor = 0;
  let setupAndDigitizingMinor = 0;
  let hasNewArtwork = false;

  for (const decoration of decorations) {
    if (!decoration.isRepeatArtwork) hasNewArtwork = true;

    const unit = decorationPerPiece(
      decoration,
      quantity,
      config,
      garment.isDark,
    );
    decorationPerPieceMinor += unit;
    lines.push({
      kind: "decoration",
      label: `${decoration.method} · ${decoration.location}`,
      quantity,
      unitAmountMinor: unit,
      extendedAmountMinor: unit * quantity,
      meta: { ...decoration },
    });

    if (decoration.isOversized) {
      const surcharge = config.settings.oversizedSurchargePerLocationMinor;
      decorationPerPieceMinor += surcharge;
      lines.push({
        kind: "oversized",
        label: `Oversized surcharge · ${decoration.location}`,
        quantity,
        unitAmountMinor: surcharge,
        extendedAmountMinor: surcharge * quantity,
      });
    }

    if (decoration.method === "screenPrint") {
      const colours = decoration.colours ?? 1;
      const perColour = decoration.isRepeatArtwork
        ? config.settings.setupFeeRepeatPerColourMinor
        : config.settings.setupFeeNewPerColourMinor;
      const setup = colours * perColour;
      setupAndDigitizingMinor += setup;
      oneTimeFeesMinor += setup;
      lines.push({
        kind: "setup",
        label: `Screen setup · ${decoration.location} (${colours}×${decoration.isRepeatArtwork ? "repeat" : "new"})`,
        quantity: 1,
        unitAmountMinor: setup,
        extendedAmountMinor: setup,
        meta: { colours, perColourMinor: perColour },
      });
    }

    if (decoration.method === "embroidery" && !decoration.isRepeatArtwork) {
      const tier =
        config.embroideryTiers[
          findTierIndex(config.embroideryTiers, quantity)
        ]!;
      setupAndDigitizingMinor += tier.digitizingFeeMinor;
      oneTimeFeesMinor += tier.digitizingFeeMinor;
      lines.push({
        kind: "digitizing",
        label: `Digitizing · ${decoration.location}`,
        quantity: 1,
        unitAmountMinor: tier.digitizingFeeMinor,
        extendedAmountMinor: tier.digitizingFeeMinor,
      });
    }
  }

  if (
    options.designHours === 0 &&
    hasNewArtwork &&
    setupAndDigitizingMinor === 0 &&
    config.settings.artworkMinimumFeeMinor > 0
  ) {
    oneTimeFeesMinor += config.settings.artworkMinimumFeeMinor;
    lines.push({
      kind: "artwork_minimum",
      label: "Artwork minimum",
      quantity: 1,
      unitAmountMinor: config.settings.artworkMinimumFeeMinor,
      extendedAmountMinor: config.settings.artworkMinimumFeeMinor,
    });
  }

  if (options.designHours > 0) {
    const design = roundMinor(
      options.designHours * config.settings.designHourlyRateMinor,
    );
    oneTimeFeesMinor += design;
    lines.push({
      kind: "design",
      label: `Design (${options.designHours}h)`,
      quantity: 1,
      unitAmountMinor: design,
      extendedAmountMinor: design,
    });
  }

  const packingMinor = options.includePacking
    ? config.settings.packingFeePerGarmentMinor * quantity
    : 0;
  if (packingMinor > 0) {
    lines.push({
      kind: "packing",
      label: "Packing",
      quantity,
      unitAmountMinor: config.settings.packingFeePerGarmentMinor,
      extendedAmountMinor: packingMinor,
    });
  }

  const shippingMinor = roundMinor(
    options.shippingCostMinor * (1 + config.settings.shippingMarkupPercent),
  );
  if (shippingMinor > 0) {
    lines.push({
      kind: "shipping",
      label: "Shipping",
      quantity: 1,
      unitAmountMinor: shippingMinor,
      extendedAmountMinor: shippingMinor,
      meta: { shippingCostMinor: options.shippingCostMinor },
    });
  }

  const perPieceMinor = garmentSellPerPieceMinor + decorationPerPieceMinor;
  const subtotalBeforeRushMinor =
    perPieceMinor * quantity + oneTimeFeesMinor + packingMinor + shippingMinor;

  let rushMinor = 0;
  let totalMinor = subtotalBeforeRushMinor;
  if (options.rush) {
    rushMinor = roundMinor(
      subtotalBeforeRushMinor * config.settings.rushFeePercent,
    );
    totalMinor += rushMinor;
    lines.push({
      kind: "rush",
      label: `Rush (${Math.round(config.settings.rushFeePercent * 100)}%)`,
      quantity: 1,
      unitAmountMinor: rushMinor,
      extendedAmountMinor: rushMinor,
    });
  }

  return {
    pricingConfigVersion: config.version,
    currency: "CAD",
    quantity,
    garmentSellPerPieceMinor,
    decorationPerPieceMinor,
    perPieceMinor,
    oneTimeFeesMinor,
    packingMinor,
    shippingMinor,
    rushMinor,
    subtotalBeforeRushMinor,
    totalMinor,
    needsArtworkReview: input.needsArtworkReview,
    lines,
  };
}

export { DEFAULT_PRICING_CONFIG_V1 } from "./default-config.js";
