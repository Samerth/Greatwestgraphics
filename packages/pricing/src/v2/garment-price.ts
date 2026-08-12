import type { PricingConfigV2 } from "@gwg/contracts";
import { interpolateByAnchor, roundMinor } from "./interpolate.js";
import type { InterpolationResult } from "./interpolate.js";

/** The epsilon keeps binary fractions like 1.005 from rounding down. */
export function round2(value: number): number {
  return Math.round(value * 100 + 1e-9) / 100;
}

/**
 * One garment's slice of the markup grid: the quantity columns and the
 * markups on its cost row. Small enough to hand to a browser, which lets the
 * storefront price a garment at any quantity with the exact same arithmetic
 * the quote engine uses, instead of a second implementation that drifts.
 */
export type GarmentPriceCurve = {
  qtyAnchors: number[];
  markups: number[];
  multiplier: number;
  mapPolicy: PricingConfigV2["garment"]["mapPolicy"];
  /** Whole-dollar cost row this curve was read from, for explanations. */
  lookupCostDollars: number;
  roundedUpToWholeDollar: boolean;
};

export type GarmentPriceResult = {
  sellPerPieceMinor: number;
  /** Before any MAP floor, for explaining why a MAP price was used. */
  calculatedMinor: number;
  baseMarkup: number;
  markup: number;
  quantityInterpolation: InterpolationResult;
  mapFloorApplied: boolean;
  mapUndercut: boolean;
};

export class GarmentPricingError extends Error {}

export function garmentPriceCurve(
  config: PricingConfigV2,
  unitCostMinor: number,
): GarmentPriceCurve {
  const {
    markupGrid,
    multiplier,
    roundCostUpToWholeDollar,
    costCapForMarkupMinor,
    mapPolicy,
  } = config.garment;

  const costDollars = unitCostMinor / 100;
  const capDollars = costCapForMarkupMinor / 100;
  const rounded = roundCostUpToWholeDollar ? Math.ceil(costDollars) : costDollars;
  const lookupCost = Math.min(
    Math.max(rounded, markupGrid.costAnchors[0]!),
    capDollars,
  );

  const costRow = interpolateByAnchor(
    markupGrid.costAnchors,
    markupGrid.costAnchors.map((_, index) => index),
    lookupCost,
  );
  // Cost rows are whole dollars, so a rounded-up cost lands on an exact row.
  const row = markupGrid.grid[Math.round(costRow.value)];
  if (!row) {
    throw new GarmentPricingError(
      `Garment markup grid has no row for a $${lookupCost} garment`,
    );
  }

  return {
    qtyAnchors: markupGrid.qtyAnchors,
    markups: row,
    multiplier,
    mapPolicy,
    lookupCostDollars: lookupCost,
    roundedUpToWholeDollar: roundCostUpToWholeDollar,
  };
}

export function priceGarmentFromCurve(
  curve: GarmentPriceCurve,
  garment: {
    unitCostMinor: number;
    quantity: number;
    mapPriceMinor?: number | null;
  },
): GarmentPriceResult {
  const quantityInterpolation = interpolateByAnchor(
    curve.qtyAnchors,
    curve.markups,
    garment.quantity,
  );
  const baseMarkup = round2(quantityInterpolation.value);
  const markup = round2(baseMarkup * curve.multiplier);
  const calculatedMinor = roundMinor(garment.unitCostMinor * markup);

  const underMap =
    garment.mapPriceMinor != null && garment.mapPriceMinor > calculatedMinor;
  const mapFloorApplied = underMap && curve.mapPolicy === "floor";

  return {
    sellPerPieceMinor: mapFloorApplied
      ? garment.mapPriceMinor!
      : calculatedMinor,
    calculatedMinor,
    baseMarkup,
    markup,
    quantityInterpolation,
    mapFloorApplied,
    mapUndercut: underMap && curve.mapPolicy === "warnOnly",
  };
}
