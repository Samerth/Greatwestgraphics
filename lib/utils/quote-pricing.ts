export const QB_PRODUCTS = [
  "T-Shirts",
  "Hoodies & Crews",
  "Polos",
  "Caps & Beanies",
  "Bags & Totes",
] as const;
export type QbProduct = (typeof QB_PRODUCTS)[number];

/** Demo vendor costs (cents) used when catalog cost is unavailable. */
export const QB_PRODUCT_COST_MINOR: Record<QbProduct, number> = {
  "T-Shirts": 800,
  "Hoodies & Crews": 2000,
  Polos: 1350,
  "Caps & Beanies": 950,
  "Bags & Totes": 550,
};

export const QB_PRODUCT_IS_DARK: Record<QbProduct, boolean> = {
  "T-Shirts": false,
  "Hoodies & Crews": false,
  Polos: false,
  "Caps & Beanies": false,
  "Bags & Totes": false,
};

export const QB_QTY_OPTIONS = [24, 48, 96, 250, 500] as const;

export const QB_METHODS = [
  { id: "screenPrint", label: "Screen print", blurb: "Best value for bulk" },
  { id: "embroidery", label: "Embroidery", blurb: "Stitched, premium look" },
  { id: "dtf", label: "DTF", blurb: "Full-colour photos & gradients" },
] as const;

export const QB_METHOD_DAYS: Record<(typeof QB_METHODS)[number]["id"], string> =
  {
    screenPrint: "5–7 business days",
    embroidery: "7–10 business days",
    dtf: "3–5 business days",
  };

export { calculateQuote } from "@gwg/pricing";
export { DEFAULT_PRICING_CONFIG_V1 } from "@gwg/pricing";

export function money(n: number) {
  return (
    "$" +
    n.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function moneyFromMinor(minor: number) {
  return money(minor / 100);
}

/** v1 stores the total on the breakdown; v2 nests it under totals. */
export function lineSnapshotTotalMinor(pricing: unknown): number | undefined {
  if (!pricing || typeof pricing !== "object") return undefined;
  const breakdown = (pricing as {
    breakdown?: { totalMinor?: number; totals?: { totalMinor?: number } };
  }).breakdown;
  const total = breakdown?.totals?.totalMinor ?? breakdown?.totalMinor;
  return typeof total === "number" ? total : undefined;
}

/**
 * Returns the authoritative line total for display, avoiding round-then-multiply drift.
 *
 * When unit prices have fractional cents (e.g., $228.08 / 12 = $19.006...), storing
 * Math.round(unit*100) as cents and then multiplying back by qty yields a different
 * total (1901 * 12 = $228.12 instead of $228.08).
 *
 * This function resolves the authoritative total in priority order:
 * 1. lineTotalMinor - explicitly stored line total
 * 2. Pricing snapshot's totalMinor - from the pricing engine breakdown
 * 3. unitPriceEstimateMinor * qty - fallback for legacy data
 */
export function getAuthoritativeLineTotalMinor(line: {
  lineTotalMinor?: number;
  unitPriceEstimateMinor?: number;
  quantity: number;
  configuration?: { pricing?: unknown };
}): number | undefined {
  if (typeof line.lineTotalMinor === "number") {
    return line.lineTotalMinor;
  }
  const snapshotTotal = lineSnapshotTotalMinor(line.configuration?.pricing);
  if (typeof snapshotTotal === "number") {
    return snapshotTotal;
  }
  if (typeof line.unitPriceEstimateMinor === "number") {
    return line.unitPriceEstimateMinor * line.quantity;
  }
  return undefined;
}
