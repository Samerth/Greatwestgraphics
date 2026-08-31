import {
  QuoteInputV2Schema,
  type DecorationMethodConfig,
  type Explain,
  type ExplainSource,
  type ExplainStep,
  type PricingConfigV2,
  type QuoteBreakdownV2,
  type QuoteDecorationLine,
  type QuoteGarmentLine,
  type QuoteInputV2,
  type QuoteLineV2,
  type Surcharge,
} from "@gwg/contracts";
import {
  allocateByWeight,
  formatMinor,
  formatRate,
  interpolateByAnchor,
  roundMinor,
} from "./interpolate.js";
import {
  garmentPriceCurve,
  priceGarmentFromCurve,
  round2,
} from "./garment-price.js";

export class PricingValidationError extends Error {
  readonly code = "PRICING_VALIDATION_ERROR";
}

type ParsedInput = ReturnType<typeof QuoteInputV2Schema.parse>;
type ParsedGarment = ParsedInput["garments"][number];
type ParsedDecoration = ParsedInput["decorations"][number];

function money(minor: number): string {
  return formatMinor(roundMinor(minor));
}

/**
 * Every colour except white counts as dark, which is deliberately blunt: staff
 * quoting a job shouldn't have to judge whether "natural" needs an underbase.
 */
export function resolveIsDark(
  garment: Pick<QuoteGarmentLine, "colourName" | "isDark">,
  rule: PricingConfigV2["settings"]["darkGarmentRule"],
): boolean {
  if (garment.isDark != null) return garment.isDark;
  if (rule === "explicit") return false;
  const colour = (garment.colourName ?? "").trim().toLowerCase();
  if (colour === "") return false;
  return colour !== "white";
}

function findMethod(
  config: PricingConfigV2,
  key: string,
): DecorationMethodConfig {
  const method = config.methods.find((candidate) => candidate.key === key);
  if (!method) {
    throw new PricingValidationError(`Unknown decoration method "${key}"`);
  }
  if (!method.enabled) {
    throw new PricingValidationError(`Method "${method.label}" is disabled`);
  }
  return method;
}

/* ------------------------------------------------------------------ */
/* Garment                                                             */
/* ------------------------------------------------------------------ */

type GarmentPricingResult = {
  sellPerPieceMinor: number;
  explain: Explain;
  warnings: string[];
};

function priceGarment(
  garment: ParsedGarment,
  config: PricingConfigV2,
): GarmentPricingResult {
  const { multiplier } = config.garment;
  const warnings: string[] = [];

  let curve;
  try {
    curve = garmentPriceCurve(config, garment.unitCostMinor);
  } catch (caught) {
    throw new PricingValidationError(
      caught instanceof Error ? caught.message : String(caught),
    );
  }

  const lookupCost = curve.lookupCostDollars;
  const roundCostUpToWholeDollar = curve.roundedUpToWholeDollar;
  const priced = priceGarmentFromCurve(curve, garment);
  const qtyInterp = priced.quantityInterpolation;
  const baseMarkup = priced.baseMarkup;
  const markup = priced.markup;
  const calculated = priced.calculatedMinor;

  const steps: ExplainStep[] = [
    {
      label: "Vendor cost",
      detail: `What we pay for the blank garment`,
      result: money(garment.unitCostMinor),
    },
    {
      label: "Markup row",
      detail: roundCostUpToWholeDollar
        ? `Cost ${money(garment.unitCostMinor)} rounds up to the $${lookupCost} row of the markup grid`
        : `Cost ${money(garment.unitCostMinor)} reads the $${lookupCost} row of the markup grid`,
      result: `$${lookupCost} row`,
    },
    {
      label: "Markup for this quantity",
      detail: qtyInterp.isFlat
        ? `${garment.quantity} pieces uses the ${qtyInterp.lowAnchor}-piece column directly`
        : `${garment.quantity} pieces sits between the ${qtyInterp.lowAnchor} column (${qtyInterp.lowValue}×) and the ${qtyInterp.highAnchor} column (${qtyInterp.highValue}×), ${Math.round(qtyInterp.fraction * 100)}% of the way across`,
      result: `${baseMarkup}×`,
    },
  ];

  if (multiplier !== 1) {
    steps.push({
      label: "Garment markup multiplier",
      detail: `Admin-wide adjustment of ${multiplier}× applied to every garment`,
      result: `${markup}×`,
    });
  }

  steps.push({
    label: "Sell price per piece",
    detail: `${money(garment.unitCostMinor)} × ${markup}`,
    result: money(calculated),
  });

  let sellPerPieceMinor = priced.sellPerPieceMinor;

  if (priced.mapFloorApplied) {
    steps.push({
      label: "MAP floor",
      detail: `The manufacturer's minimum advertised price of ${money(garment.mapPriceMinor!)} is higher than our calculated price, so it is used instead`,
      result: money(sellPerPieceMinor),
    });
  } else if (priced.mapUndercut) {
    warnings.push(
      `Garment "${garment.description || garment.id}" prices below its MAP of ${money(garment.mapPriceMinor!)} (calculated ${money(calculated)}).`,
    );
  }

  if (garment.overrideSellPerPieceMinor != null) {
    steps.push({
      label: "Staff override",
      detail: garment.overrideReason
        ? `Price set manually: ${garment.overrideReason}`
        : "Price set manually by staff",
      result: money(garment.overrideSellPerPieceMinor),
    });
    sellPerPieceMinor = garment.overrideSellPerPieceMinor;
  }

  const sources: ExplainSource[] = [
    {
      label: "Garment markup grid",
      path: "garment.markupGrid",
      value: `$${lookupCost} cost row, ${garment.quantity} pieces → ${baseMarkup}×`,
    },
    {
      label: "Garment markup multiplier",
      path: "garment.multiplier",
      value: `${multiplier}×`,
    },
  ];

  return {
    sellPerPieceMinor,
    warnings,
    explain: {
      plainEnglish: `${money(garment.unitCostMinor)} cost × ${markup} markup (the $${lookupCost} row at ${garment.quantity} pieces) = ${money(sellPerPieceMinor)} per piece.`,
      steps,
      sources,
    },
  };
}

/**
 * The blank-garment price on its own, for surfaces that show a garment
 * without decoration — catalog tiles, product pages, the design studio.
 * Uses exactly the same grid and multiplier as a full quote, so a browsing
 * price and a quoted price can never disagree.
 */
export function garmentSellPerPieceMinor(
  config: PricingConfigV2,
  garment: {
    unitCostMinor: number;
    quantity: number;
    mapPriceMinor?: number | null;
  },
): number {
  return priceGarment(
    {
      id: "catalog",
      description: "",
      unitCostMinor: garment.unitCostMinor,
      quantity: Math.max(1, Math.round(garment.quantity)),
      colourName: "",
      mapPriceMinor: garment.mapPriceMinor ?? undefined,
      isDark: undefined,
      overrideSellPerPieceMinor: undefined,
      overrideReason: undefined,
    },
    config,
  ).sellPerPieceMinor;
}

/* ------------------------------------------------------------------ */
/* Decoration run charge                                               */
/* ------------------------------------------------------------------ */

type RateResult = {
  rateMinor: number;
  steps: ExplainStep[];
  sources: ExplainSource[];
  summary: string;
};

function resolveRate(
  method: DecorationMethodConfig,
  decoration: ParsedDecoration,
  quantity: number,
): RateResult {
  const model = method.rateModel;
  const steps: ExplainStep[] = [];
  const sources: ExplainSource[] = [];

  function describeQty(interp: ReturnType<typeof interpolateByAnchor>, what: string) {
    return interp.isFlat
      ? `${quantity} pieces uses the ${interp.lowAnchor}-piece ${what} of ${formatRate(interp.lowValue)} directly`
      : `${quantity} pieces sits between the ${interp.lowAnchor}-piece ${what} (${formatRate(interp.lowValue)}) and the ${interp.highAnchor}-piece ${what} (${formatRate(interp.highValue)})`;
  }

  function interpolationStep(interp: ReturnType<typeof interpolateByAnchor>) {
    if (interp.isFlat) return null;
    return {
      label: "Interpolated for exact quantity",
      detail: `${formatRate(interp.lowValue)} + (${quantity} − ${interp.lowAnchor}) ÷ (${interp.highAnchor} − ${interp.lowAnchor}) × (${formatRate(interp.highValue)} − ${formatRate(interp.lowValue)})`,
      result: formatRate(interp.value),
    } satisfies ExplainStep;
  }

  switch (model.kind) {
    case "matrixByColour": {
      const colours = decoration.colours;
      if (colours == null) {
        throw new PricingValidationError(
          `${method.label} needs a colour count on location "${decoration.location}"`,
        );
      }
      if (colours < model.minColours || colours > model.maxColours) {
        throw new PricingValidationError(
          `${method.label} supports ${model.minColours}–${model.maxColours} colours, got ${colours}`,
        );
      }
      const rates = model.ratesByColour[String(colours)];
      if (!rates) {
        throw new PricingValidationError(
          `${method.label} has no rates configured for ${colours} colour(s)`,
        );
      }
      const interp = interpolateByAnchor(model.qtyAnchors, rates, quantity);
      steps.push({
        label: "Rate table",
        detail: `${colours} colour${colours === 1 ? "" : "s"}. ${describeQty(interp, "rate")}`,
        result: formatRate(interp.value),
      });
      const step = interpolationStep(interp);
      if (step) steps.push(step);
      sources.push({
        label: `${method.label} rates · ${colours} colour${colours === 1 ? "" : "s"}`,
        path: `methods.${method.key}.rateModel.ratesByColour.${colours}`,
        value: `${formatRate(interp.lowValue)} at ${interp.lowAnchor} pieces`,
      });
      return {
        rateMinor: interp.value,
        steps,
        sources,
        summary: `${colours}-colour ${method.label.toLowerCase()}`,
      };
    }

    case "baseWithVariable": {
      const value = decoration.variableValue;
      if (value == null) {
        throw new PricingValidationError(
          `${method.label} needs ${model.variable.label.toLowerCase()} on location "${decoration.location}"`,
        );
      }
      const baseInterp = interpolateByAnchor(model.qtyAnchors, model.baseMinor, quantity);
      const extraInterp = interpolateByAnchor(
        model.qtyAnchors,
        model.extraPerUnitMinor,
        quantity,
      );
      const rawUnits = Math.max(0, (value - model.variable.includedUnits) / model.variable.unitSize);
      const units = model.variable.roundUpPartialUnits ? Math.ceil(rawUnits) : rawUnits;
      const extraMinor = units * extraInterp.value;

      steps.push({
        label: "Base rate",
        detail: `Covers the first ${model.variable.includedUnits.toLocaleString()} ${model.variable.label.toLowerCase()}. ${describeQty(baseInterp, "base rate")}`,
        result: formatRate(baseInterp.value),
      });
      const baseStep = interpolationStep(baseInterp);
      if (baseStep) steps.push(baseStep);

      if (units > 0) {
        steps.push({
          label: `Extra ${model.variable.label.toLowerCase()}`,
          detail: `${value.toLocaleString()} − ${model.variable.includedUnits.toLocaleString()} = ${(value - model.variable.includedUnits).toLocaleString()} extra, billed as ${round2(units)} × ${formatRate(extraInterp.value)} per ${model.variable.unitSize.toLocaleString()}`,
          result: formatRate(extraMinor),
        });
      } else {
        steps.push({
          label: `Extra ${model.variable.label.toLowerCase()}`,
          detail: `${value.toLocaleString()} is within the included ${model.variable.includedUnits.toLocaleString()}, so nothing extra is charged`,
          result: formatRate(0),
        });
      }

      sources.push(
        {
          label: `${method.label} base rates`,
          path: `methods.${method.key}.rateModel.baseMinor`,
          value: `${formatRate(baseInterp.lowValue)} at ${baseInterp.lowAnchor} pieces`,
        },
        {
          label: `${method.label} rate per ${model.variable.unitSize.toLocaleString()} ${model.variable.label.toLowerCase()}`,
          path: `methods.${method.key}.rateModel.extraPerUnitMinor`,
          value: `${formatRate(extraInterp.lowValue)} at ${extraInterp.lowAnchor} pieces`,
        },
      );

      return {
        rateMinor: baseInterp.value + extraMinor,
        steps,
        sources,
        summary: `${method.label.toLowerCase()}, ${value.toLocaleString()} ${model.variable.label.toLowerCase()}`,
      };
    }

    case "matrixByOption": {
      const optionKey = decoration.optionKey;
      if (optionKey == null) {
        throw new PricingValidationError(
          `${method.label} needs a size or option on location "${decoration.location}"`,
        );
      }
      const option = model.options.find((candidate) => candidate.key === optionKey);
      const rates = model.ratesByOption[optionKey];
      if (!option || !rates) {
        throw new PricingValidationError(
          `${method.label} has no option "${optionKey}" configured`,
        );
      }
      const interp = interpolateByAnchor(model.qtyAnchors, rates, quantity);
      steps.push({
        label: "Rate table",
        detail: `${option.label}. ${describeQty(interp, "rate")}`,
        result: formatRate(interp.value),
      });
      const step = interpolationStep(interp);
      if (step) steps.push(step);
      sources.push({
        label: `${method.label} rates · ${option.label}`,
        path: `methods.${method.key}.rateModel.ratesByOption.${optionKey}`,
        value: `${formatRate(interp.lowValue)} at ${interp.lowAnchor} pieces`,
      });
      return {
        rateMinor: interp.value,
        steps,
        sources,
        summary: `${option.label} ${method.label.toLowerCase()}`,
      };
    }

    case "flatByQty": {
      const interp = interpolateByAnchor(model.qtyAnchors, model.ratesMinor, quantity);
      steps.push({
        label: "Rate table",
        detail: describeQty(interp, "rate"),
        result: formatRate(interp.value),
      });
      const step = interpolationStep(interp);
      if (step) steps.push(step);
      sources.push({
        label: `${method.label} rates`,
        path: `methods.${method.key}.rateModel.ratesMinor`,
        value: `${formatRate(interp.lowValue)} at ${interp.lowAnchor} pieces`,
      });
      return {
        rateMinor: interp.value,
        steps,
        sources,
        summary: method.label.toLowerCase(),
      };
    }

    default: {
      const exhaustive: never = model;
      throw new PricingValidationError(`Unsupported rate model ${JSON.stringify(exhaustive)}`);
    }
  }
}

function surchargeApplies(
  surcharge: Surcharge,
  decoration: ParsedDecoration,
  isDark: boolean,
): boolean {
  if (!surcharge.enabled) return false;
  switch (surcharge.appliesWhen) {
    case "always":
      return true;
    case "garmentIsDark":
      return isDark;
    case "locationFlagged":
      return decoration.isOversized;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Quote                                                               */
/* ------------------------------------------------------------------ */

export function calculateQuoteV2(
  rawInput: QuoteInputV2,
  config: PricingConfigV2,
): QuoteBreakdownV2 {
  const input = QuoteInputV2Schema.parse(rawInput);
  const { settings } = config;
  const warnings: string[] = [];
  const lines: QuoteLineV2[] = [];

  const totalQuantity = input.garments.reduce(
    (sum, garment) => sum + garment.quantity,
    0,
  );
  if (totalQuantity < settings.minimumOrderQty) {
    throw new PricingValidationError(
      `Minimum order is ${settings.minimumOrderQty} piece(s); this quote has ${totalQuantity}`,
    );
  }

  const garmentById = new Map<string, ParsedGarment>();
  for (const garment of input.garments) {
    if (garmentById.has(garment.id)) {
      throw new PricingValidationError(`Duplicate garment id "${garment.id}"`);
    }
    garmentById.set(garment.id, garment);
  }

  let merchandiseMinor = 0;
  let estimatedCostMinor = 0;
  const decorationPerPiece = new Map<string, number>();

  for (const garment of input.garments) {
    const priced = priceGarment(garment, config);
    warnings.push(...priced.warnings);
    const extended = priced.sellPerPieceMinor * garment.quantity;
    merchandiseMinor += extended;
    estimatedCostMinor += garment.unitCostMinor * garment.quantity;
    decorationPerPiece.set(garment.id, 0);

    lines.push({
      id: `garment:${garment.id}`,
      kind: "garment",
      garmentId: garment.id,
      label: garment.description || `Garment ${garment.id}`,
      quantity: garment.quantity,
      unitAmountMinor: priced.sellPerPieceMinor,
      extendedAmountMinor: extended,
      costMinor: garment.unitCostMinor * garment.quantity,
      isOverride: garment.overrideSellPerPieceMinor != null,
      explain: priced.explain,
    });
  }

  /* Decoration run charges and surcharges. */
  let decorationMinor = 0;
  let threadMinor = 0;
  let needsArtworkVerification = false;
  const threadJobCharged = new Set<string>();

  for (const decoration of input.decorations) {
    const garment = garmentById.get(decoration.garmentId);
    if (!garment) {
      throw new PricingValidationError(
        `Decoration "${decoration.location}" references unknown garment "${decoration.garmentId}"`,
      );
    }
    const method = findMethod(config, decoration.methodKey);
    const isDark = resolveIsDark(garment, settings.darkGarmentRule);
    const quantity = garment.quantity;

    const rate = resolveRate(method, decoration, quantity);
    const steps = [...rate.steps];
    const sources = [...rate.sources];
    let unitMinor = rate.rateMinor;

    if (method.multiplier !== 1) {
      unitMinor *= method.multiplier;
      steps.push({
        label: `${method.label} multiplier`,
        detail: `Admin-wide adjustment of ${method.multiplier}× applied to the run charge`,
        result: formatRate(unitMinor),
      });
    }
    sources.push({
      label: `${method.label} multiplier`,
      path: `methods.${method.key}.multiplier`,
      value: `${method.multiplier}×`,
    });

    const minimum = method.minimumChargePerLocationMinor;
    if (minimum > 0) {
      const runTotal = unitMinor * quantity;
      if (runTotal < minimum) {
        const floored = minimum / quantity;
        steps.push({
          label: "Minimum charge applied",
          detail: `${formatRate(unitMinor)} × ${quantity} pieces = ${money(runTotal)}, below the ${money(minimum)} minimum for one ${method.label.toLowerCase()} location, so the minimum is charged instead`,
          result: `${formatRate(floored)} per piece`,
        });
        unitMinor = floored;
      } else {
        steps.push({
          label: "Minimum charge",
          detail: `${money(runTotal)} for this location is above the ${money(minimum)} minimum, so the minimum does not apply`,
          result: "Not applied",
        });
      }
      sources.push({
        label: `${method.label} minimum per location`,
        path: `methods.${method.key}.minimumChargePerLocationMinor`,
        value: money(minimum),
      });
    }

    if (decoration.overrideUnitAmountMinor != null) {
      steps.push({
        label: "Staff override",
        detail: decoration.overrideReason
          ? `Rate set manually: ${decoration.overrideReason}`
          : "Rate set manually by staff",
        result: money(decoration.overrideUnitAmountMinor),
      });
      unitMinor = decoration.overrideUnitAmountMinor;
    }

    // The rate is rounded to cents before extending so a quote always
    // reconciles: unit price x quantity equals the line total exactly.
    const unitRounded = roundMinor(unitMinor);
    const extended = unitRounded * quantity;
    decorationMinor += extended;
    decorationPerPiece.set(
      garment.id,
      (decorationPerPiece.get(garment.id) ?? 0) + unitRounded,
    );
    estimatedCostMinor += roundMinor(extended * method.costModel.runCostRatio);

    lines.push({
      id: `decoration:${decoration.id}`,
      kind: "decoration",
      garmentId: garment.id,
      decorationId: decoration.id,
      label: `${method.label} · ${decoration.location}`,
      quantity,
      unitAmountMinor: unitRounded,
      extendedAmountMinor: extended,
      costMinor: roundMinor(extended * method.costModel.runCostRatio),
      isOverride: decoration.overrideUnitAmountMinor != null,
      explain: {
        plainEnglish: `${rate.summary} on ${quantity} piece${quantity === 1 ? "" : "s"} at ${money(unitRounded)} each.`,
        steps,
        sources,
      },
    });

    /* Surcharges are their own lines so nothing is buried inside a rate. */
    for (const surcharge of method.surcharges) {
      if (!surchargeApplies(surcharge, decoration, isDark)) continue;

      const surchargeUnit = roundMinor(
        surcharge.kind === "percent" ? unitRounded * surcharge.value : surcharge.value,
      );
      const surchargeExtended = surchargeUnit * quantity;
      decorationMinor += surchargeExtended;
      decorationPerPiece.set(
        garment.id,
        (decorationPerPiece.get(garment.id) ?? 0) + surchargeUnit,
      );

      const why =
        surcharge.appliesWhen === "garmentIsDark"
          ? `Garment colour "${garment.colourName || "unspecified"}" is not white, so it counts as dark`
          : surcharge.appliesWhen === "locationFlagged"
            ? `This location is flagged as oversized`
            : `Always applied to ${method.label.toLowerCase()}`;

      lines.push({
        id: `surcharge:${decoration.id}:${surcharge.key}`,
        kind: "surcharge",
        garmentId: garment.id,
        decorationId: decoration.id,
        label: `${surcharge.label} · ${decoration.location}`,
        quantity,
        unitAmountMinor: surchargeUnit,
        extendedAmountMinor: surchargeExtended,
        costMinor: 0,
        isOverride: false,
        explain: {
          plainEnglish:
            surcharge.kind === "percent"
              ? `${why}, adding ${Math.round(surcharge.value * 100)}% to the ${method.label.toLowerCase()} charge.`
              : `${why}, adding ${money(surcharge.value)} per piece.`,
          steps: [
            { label: "Why it applies", detail: why },
            {
              label: "Amount",
              detail:
                surcharge.kind === "percent"
                  ? `${money(unitRounded)} × ${Math.round(surcharge.value * 100)}% = ${money(surchargeUnit)} per piece × ${quantity} pieces`
                  : `${money(surcharge.value)} per piece × ${quantity} pieces`,
              result: money(surchargeExtended),
            },
          ],
          sources: [
            {
              label: `${method.label} · ${surcharge.label}`,
              path: `methods.${method.key}.surcharges.${surcharge.key}`,
              value:
                surcharge.kind === "percent"
                  ? `+${Math.round(surcharge.value * 100)}%`
                  : `${money(surcharge.value)} per piece`,
            },
          ],
        },
      });
    }

    if (
      decoration.artwork.isRepeat &&
      !decoration.artwork.verifiedByStaff &&
      method.setup.repeatRequiresVerification
    ) {
      needsArtworkVerification = true;
    }

    const thread = method.threadFee;
    if (thread?.enabled && thread.amountMinor > 0) {
      const perPiece = thread.kind === "flatPerPiece";
      if (!perPiece && threadJobCharged.has(method.key)) {
        // Per-job thread is billed once for the method, not per location.
      } else {
        if (!perPiece) threadJobCharged.add(method.key);
        let threadUnit = thread.amountMinor;
        if (thread.multiplierApplies) threadUnit *= method.multiplier;
        threadUnit = roundMinor(threadUnit);
        const threadQty = perPiece ? quantity : 1;
        const threadExtended = threadUnit * threadQty;
        threadMinor += threadExtended;

        if (perPiece) {
          decorationPerPiece.set(
            garment.id,
            (decorationPerPiece.get(garment.id) ?? 0) + threadUnit,
          );
        }

        lines.push({
          id: perPiece
            ? `thread:${decoration.id}`
            : `thread:${method.key}`,
          kind: "thread",
          garmentId: garment.id,
          decorationId: decoration.id,
          label: perPiece
            ? `${thread.label} · ${decoration.location}`
            : `${thread.label} · ${method.label}`,
          quantity: threadQty,
          unitAmountMinor: threadUnit,
          extendedAmountMinor: threadExtended,
          costMinor: 0,
          isOverride: false,
          explain: {
            plainEnglish: perPiece
              ? `${thread.label} of ${money(threadUnit)} per piece on ${quantity} ${method.label.toLowerCase()} pieces.`
              : `${thread.label} of ${money(threadUnit)} charged once for this ${method.label.toLowerCase()} job.`,
            steps: [
              {
                label: thread.label,
                detail: perPiece
                  ? `${money(thread.amountMinor)} per piece × ${quantity} pieces`
                  : `${money(thread.amountMinor)} once per job`,
                result: money(threadExtended),
              },
            ],
            sources: [
              {
                label: `${method.label} · ${thread.label}`,
                path: `methods.${method.key}.threadFee.amountMinor`,
                value: money(thread.amountMinor),
              },
            ],
          },
        });
      }
    }
  }

  /* Setup fees: one per logo group, split across the garments that use it. */
  let setupMinor = 0;
  const groups = new Map<string, ParsedDecoration[]>();
  for (const decoration of input.decorations) {
    const method = findMethod(config, decoration.methodKey);
    const sharing = method.setup.shareAcrossGarments && decoration.logoGroup !== "";
    const key = sharing
      ? `${decoration.methodKey}::group::${decoration.logoGroup}`
      : `${decoration.methodKey}::single::${decoration.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(decoration);
    else groups.set(key, [decoration]);
  }

  for (const [, members] of groups) {
    const lead = members[0]!;
    const method = findMethod(config, lead.methodKey);
    const setup = method.setup;

    const verified = lead.artwork.isRepeat && lead.artwork.verifiedByStaff;
    const claimedButUnverified =
      lead.artwork.isRepeat && !lead.artwork.verifiedByStaff;
    const useRepeat = setup.repeatRequiresVerification
      ? verified
      : lead.artwork.isRepeat;

    /**
     * perJob always bills (new or repeat rate).
     * perCustomer / once skip the fee after a verified repeat — that's how
     * digitizing is "one-time per customer" in the workbook.
     */
    const frequency = setup.frequency ?? "perJob";
    const skipForReturningCustomer =
      (frequency === "perCustomer" || frequency === "once") && useRepeat;

    const perUnitFee = skipForReturningCustomer
      ? 0
      : useRepeat
        ? setup.repeatFeeMinor
        : setup.newFeeMinor;
    const multiplierCount =
      setup.per === "colour" ? (lead.colours ?? 1) : 1;
    let groupFee = perUnitFee * multiplierCount;
    if (setup.multiplierApplies) groupFee *= method.multiplier;
    groupFee = roundMinor(groupFee);

    if (claimedButUnverified && setup.repeatRequiresVerification) {
      warnings.push(
        `${method.label} on "${lead.location}" is claimed as repeat artwork but has not been verified by staff, so new-artwork pricing was used.`,
      );
    }

    if (groupFee <= 0) continue;

    const quantities = members.map(
      (member) => garmentById.get(member.garmentId)!.quantity,
    );
    const shares = allocateByWeight(groupFee, quantities);
    const groupQuantity = quantities.reduce((sum, qty) => sum + qty, 0);
    const isShared = members.length > 1;

    members.forEach((member, index) => {
      const share = shares[index]!;
      if (share <= 0) return;
      setupMinor += share;
      estimatedCostMinor += roundMinor(share * method.costModel.setupCostRatio);

      const basis =
        setup.per === "colour"
          ? `${multiplierCount} colour${multiplierCount === 1 ? "" : "s"} × ${money(perUnitFee)} per colour`
          : setup.per === "design"
            ? `${money(perUnitFee)} per design`
            : `${money(perUnitFee)} per location`;

      const frequencyLabel =
        frequency === "perJob"
          ? "Charged every job"
          : frequency === "perCustomer"
            ? "Charged once per customer for this artwork"
            : "Charged once for this artwork";

      const steps: ExplainStep[] = [
        {
          label: "Artwork status",
          detail: useRepeat
            ? `Repeat artwork, verified by ${lead.artwork.verifiedBy || "staff"}, so the repeat rate applies`
            : claimedButUnverified
              ? "Customer says this is repeat artwork, but staff have not verified it yet, so the new-artwork rate applies"
              : "New artwork, so the new-artwork rate applies",
          result: useRepeat ? "Repeat" : "New",
        },
        {
          label: "When it is charged",
          detail: frequencyLabel,
          result:
            frequency === "perJob"
              ? "Every job"
              : frequency === "perCustomer"
                ? "Per customer"
                : "Once",
        },
        {
          label: "Fee basis",
          detail: basis,
          result: money(groupFee),
        },
      ];

      if (setup.multiplierApplies) {
        steps.push({
          label: `${method.label} multiplier`,
          detail: `Applied to this setup fee at ${method.multiplier}×`,
          result: money(groupFee),
        });
      } else {
        steps.push({
          label: `${method.label} multiplier`,
          detail: `Not applied — ${setup.label.toLowerCase()} is a pass-through cost, not margin`,
          result: "Excluded",
        });
      }

      if (isShared) {
        steps.push({
          label: "Shared across garments",
          detail: `Logo "${lead.logoGroup}" is used on ${members.length} garments totalling ${groupQuantity} pieces. This line carries ${quantities[index]} of them, so it pays ${quantities[index]}/${groupQuantity} of ${money(groupFee)}`,
          result: money(share),
        });
      }

      lines.push({
        id: `setup:${member.id}`,
        kind: "setup",
        garmentId: member.garmentId,
        decorationId: member.id,
        label: isShared
          ? `${setup.label} · ${lead.location} (shared)`
          : `${setup.label} · ${member.location}`,
        quantity: 1,
        unitAmountMinor: share,
        extendedAmountMinor: share,
        costMinor: roundMinor(share * method.costModel.setupCostRatio),
        isOverride: false,
        explain: {
          plainEnglish: isShared
            ? `${setup.label} of ${money(groupFee)} for logo "${lead.logoGroup}", split by quantity — ${money(share)} on this garment.`
            : `${setup.label}: ${basis} = ${money(share)}, charged once.`,
          steps,
          sources: [
            {
              label: `${method.label} · ${setup.label} (${useRepeat ? "repeat" : "new"})`,
              path: `methods.${method.key}.setup.${useRepeat ? "repeatFeeMinor" : "newFeeMinor"}`,
              value: money(perUnitFee),
            },
            {
              label: `${method.label} · setup frequency`,
              path: `methods.${method.key}.setup.frequency`,
              value: frequency,
            },
          ],
        },
      });
    });
  }

  /* Design time and the artwork minimum. */
  let oneTimeExtrasMinor = 0;

  if (input.options.designHours > 0 && settings.designHourlyRateMinor > 0) {
    const design = roundMinor(input.options.designHours * settings.designHourlyRateMinor);
    oneTimeExtrasMinor += design;
    lines.push({
      id: "design",
      kind: "design",
      label: `Design time (${input.options.designHours}h)`,
      quantity: 1,
      unitAmountMinor: design,
      extendedAmountMinor: design,
      costMinor: 0,
      isOverride: false,
      explain: {
        plainEnglish: `${input.options.designHours} hour(s) of design at ${money(settings.designHourlyRateMinor)} per hour.`,
        steps: [
          {
            label: "Design time",
            detail: `${input.options.designHours} × ${money(settings.designHourlyRateMinor)} per hour`,
            result: money(design),
          },
        ],
        sources: [
          {
            label: "Design hourly rate",
            path: "settings.designHourlyRateMinor",
            value: money(settings.designHourlyRateMinor),
          },
        ],
      },
    });
  }

  const hasNewArtwork = input.decorations.some(
    (decoration) => !decoration.artwork.isRepeat,
  );
  if (
    settings.artworkMinimumFeeMinor > 0 &&
    hasNewArtwork &&
    setupMinor === 0 &&
    input.options.designHours === 0
  ) {
    oneTimeExtrasMinor += settings.artworkMinimumFeeMinor;
    lines.push({
      id: "artworkMinimum",
      kind: "artworkMinimum",
      label: "Artwork minimum",
      quantity: 1,
      unitAmountMinor: settings.artworkMinimumFeeMinor,
      extendedAmountMinor: settings.artworkMinimumFeeMinor,
      costMinor: 0,
      isOverride: false,
      explain: {
        plainEnglish: `New artwork was prepared but no setup or digitizing fee was charged, so the artwork minimum applies once.`,
        steps: [
          {
            label: "Why it applies",
            detail:
              "There is new artwork on this quote, no setup or digitizing fee was charged, and no design hours were billed",
          },
          {
            label: "Amount",
            detail: "Charged once per quote",
            result: money(settings.artworkMinimumFeeMinor),
          },
        ],
        sources: [
          {
            label: "Artwork minimum",
            path: "settings.artworkMinimumFeeMinor",
            value: money(settings.artworkMinimumFeeMinor),
          },
        ],
      },
    });
  }

  /* Packing. */
  let packingMinor = 0;
  if (input.options.includePacking && settings.packingFeePerGarmentMinor > 0) {
    packingMinor = settings.packingFeePerGarmentMinor * totalQuantity;
    lines.push({
      id: "packing",
      kind: "packing",
      label: "Individual packing",
      quantity: totalQuantity,
      unitAmountMinor: settings.packingFeePerGarmentMinor,
      extendedAmountMinor: packingMinor,
      costMinor: 0,
      isOverride: false,
      explain: {
        plainEnglish: `${money(settings.packingFeePerGarmentMinor)} per garment to fold and bag, across ${totalQuantity} pieces.`,
        steps: [
          {
            label: "Packing",
            detail: `${money(settings.packingFeePerGarmentMinor)} × ${totalQuantity} pieces`,
            result: money(packingMinor),
          },
        ],
        sources: [
          {
            label: "Packing fee per garment",
            path: "settings.packingFeePerGarmentMinor",
            value: money(settings.packingFeePerGarmentMinor),
          },
        ],
      },
    });
  }

    /* Individual names/numbers. */
  let namesNumbersMinor = 0;
  if (input.options.namesNumbers && settings.namesNumbersFeePerGarmentMinor > 0) {
    namesNumbersMinor = settings.namesNumbersFeePerGarmentMinor * totalQuantity;
    lines.push({
      id: "namesNumbers",
      kind: "namesNumbers",
      label: "Individual names/numbers",
      quantity: totalQuantity,
      unitAmountMinor: settings.namesNumbersFeePerGarmentMinor,
      extendedAmountMinor: namesNumbersMinor,
      costMinor: 0,
      isOverride: false,
      explain: {
        plainEnglish: `${money(settings.namesNumbersFeePerGarmentMinor)} per garment to add an individual name and/or number, across ${totalQuantity} pieces.`,
        steps: [
          {
            label: "Names/numbers",
            detail: `${money(settings.namesNumbersFeePerGarmentMinor)} × ${totalQuantity} pieces`,
            result: money(namesNumbersMinor),
          },
        ],
        sources: [
          {
            label: "Names/numbers fee per garment",
            path: "settings.namesNumbersFeePerGarmentMinor",
            value: money(settings.namesNumbersFeePerGarmentMinor),
          },
        ],
      },
    });
  }

  /* Shipping — quoted at cost plus markup, and never part of the rush base. */
  let shippingMinor = 0;
  if (input.options.overrideShippingMinor != null) {
    shippingMinor = input.options.overrideShippingMinor;
  } else if (input.options.shippingCostMinor > 0) {
    shippingMinor = roundMinor(
      input.options.shippingCostMinor * (1 + settings.shippingMarkupPercent),
    );
  }
  if (shippingMinor > 0) {
    lines.push({
      id: "shipping",
      kind: "shipping",
      label: "Shipping",
      quantity: 1,
      unitAmountMinor: shippingMinor,
      extendedAmountMinor: shippingMinor,
      costMinor: input.options.shippingCostMinor,
      isOverride: input.options.overrideShippingMinor != null,
      explain: {
        plainEnglish:
          input.options.overrideShippingMinor != null
            ? `Shipping set manually to ${money(shippingMinor)}.`
            : `Actual freight of ${money(input.options.shippingCostMinor)} plus ${Math.round(settings.shippingMarkupPercent * 100)}% handling.`,
        steps: [
          {
            label: "Freight cost",
            detail: "What the carrier charges us",
            result: money(input.options.shippingCostMinor),
          },
          {
            label: "Handling markup",
            detail: `+${Math.round(settings.shippingMarkupPercent * 100)}%`,
            result: money(shippingMinor),
          },
        ],
        sources: [
          {
            label: "Shipping markup",
            path: "settings.shippingMarkupPercent",
            value: `${Math.round(settings.shippingMarkupPercent * 100)}%`,
          },
        ],
      },
    });
  }

  /* Rush. */
  const productionSubtotalMinor =
    merchandiseMinor +
    decorationMinor +
    setupMinor +
    threadMinor +
    oneTimeExtrasMinor +
    packingMinor +
    namesNumbersMinor;
  const rushBaseMinor =
    settings.rushAppliesTo === "everything"
      ? productionSubtotalMinor + shippingMinor
      : productionSubtotalMinor;

  let rushMinor = 0;
  if (input.options.overrideRushMinor != null) {
    rushMinor = input.options.overrideRushMinor;
  } else if (input.options.rush) {
    rushMinor = roundMinor(rushBaseMinor * settings.rushFeePercent);
  }
  if (rushMinor > 0) {
    lines.push({
      id: "rush",
      kind: "rush",
      label: `Rush (${Math.round(settings.rushFeePercent * 100)}%)`,
      quantity: 1,
      unitAmountMinor: rushMinor,
      extendedAmountMinor: rushMinor,
      costMinor: 0,
      isOverride: input.options.overrideRushMinor != null,
      explain: {
        plainEnglish:
          settings.rushAppliesTo === "everything"
            ? `${Math.round(settings.rushFeePercent * 100)}% of the whole quote including shipping.`
            : `${Math.round(settings.rushFeePercent * 100)}% of garments, decoration, setup and packing (${money(rushBaseMinor)}). Shipping is excluded.`,
        steps: [
          {
            label: "Rush base",
            detail:
              settings.rushAppliesTo === "everything"
                ? "Everything on the quote, including shipping"
                : "Garments, decoration, setup fees and packing. Shipping is excluded",
            result: money(rushBaseMinor),
          },
          {
            label: "Rush rate",
            detail: `${money(rushBaseMinor)} × ${Math.round(settings.rushFeePercent * 100)}%`,
            result: money(rushMinor),
          },
        ],
        sources: [
          {
            label: "Rush fee",
            path: "settings.rushFeePercent",
            value: `${Math.round(settings.rushFeePercent * 100)}%`,
          },
          {
            label: "Rush applies to",
            path: "settings.rushAppliesTo",
            value:
              settings.rushAppliesTo === "everything"
                ? "Whole quote"
                : "Production only, excluding shipping",
          },
        ],
      },
    });
  }

  const subtotalBeforeRushMinor = productionSubtotalMinor + shippingMinor;
  let totalMinor = subtotalBeforeRushMinor + rushMinor;

  if (input.options.overrideTotalMinor != null) {
    warnings.push(
      `Quote total was overridden to ${money(input.options.overrideTotalMinor)}${
        input.options.overrideReason ? ` (${input.options.overrideReason})` : ""
      }; the calculated total was ${money(totalMinor)}.`,
    );
    totalMinor = input.options.overrideTotalMinor;
  }

  const grossProfitMinor = totalMinor - estimatedCostMinor;
  const grossMarginPercent = totalMinor > 0 ? grossProfitMinor / totalMinor : 0;
  if (grossMarginPercent < settings.marginWarningThreshold) {
    warnings.push(
      `Gross margin is ${(grossMarginPercent * 100).toFixed(1)}%, below the ${(settings.marginWarningThreshold * 100).toFixed(0)}% warning threshold.`,
    );
  }
  if (needsArtworkVerification) {
    warnings.push(
      "One or more locations claim repeat artwork that staff have not verified yet.",
    );
  }

  const garments = input.garments.map((garment) => {
    const line = lines.find(
      (candidate) => candidate.kind === "garment" && candidate.garmentId === garment.id,
    )!;
    const decorationUnit = roundMinor(decorationPerPiece.get(garment.id) ?? 0);
    return {
      garmentId: garment.id,
      quantity: garment.quantity,
      unitCostMinor: garment.unitCostMinor,
      sellPerPieceMinor: line.unitAmountMinor,
      decorationPerPieceMinor: decorationUnit,
      unitPriceMinor: line.unitAmountMinor + decorationUnit,
      extendedMinor: line.extendedAmountMinor,
    };
  });

  return {
    pricingConfigVersion: config.version,
    currency: "CAD",
    totalQuantity,
    garments,
    lines,
    totals: {
      merchandiseMinor,
      decorationMinor,
      setupMinor,
      threadMinor,
      packingMinor,
      namesNumbersMinor,
      shippingMinor,
      rushMinor,
      productionSubtotalMinor,
      subtotalBeforeRushMinor,
      totalMinor,
      estimatedCostMinor,
      grossProfitMinor,
      grossMarginPercent: round2(grossMarginPercent * 100) / 100,
    },
    warnings,
    needsArtworkVerification,
    expiresInDays: settings.quoteValidityDays,
  };
}
