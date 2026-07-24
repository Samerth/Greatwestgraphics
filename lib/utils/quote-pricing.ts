export const QB_PRODUCTS = [
  "T-Shirts",
  "Hoodies & Crews",
  "Polos",
  "Caps & Beanies",
  "Bags & Totes",
] as const;
export type QbProduct = (typeof QB_PRODUCTS)[number];

export const QB_PRODUCT_BASE: Record<QbProduct, number> = {
  "T-Shirts": 8.0,
  "Hoodies & Crews": 20.0,
  Polos: 13.5,
  "Caps & Beanies": 9.5,
  "Bags & Totes": 5.5,
};

export const QB_QTY_OPTIONS = [24, 48, 96, 250, 500] as const;

// Breakpoints must stay sorted ascending by quantity — getQtyMultiplier
// assumes this order when it walks the array looking for a bracket.
export const QB_QTY_BREAKPOINTS: Array<[qty: number, mult: number]> = [
  [24, 1.25],
  [48, 1.0],
  [96, 0.85],
  [250, 0.72],
  [500, 0.6],
];

// Kept for anything still keying off exact preset values.
export const QB_QTY_MULT: Record<number, number> = Object.fromEntries(
  QB_QTY_BREAKPOINTS
);

/**
 * Returns a per-unit price multiplier for ANY quantity, not just the
 * five presets. Exact preset matches return the table value directly.
 * Quantities between two presets are linearly interpolated. Quantities
 * outside the table's range are extrapolated along the nearest edge
 * segment's slope, clamped so pricing never goes negative or absurd.
 */
export function getQtyMultiplier(qty: number): number {
  const pts = QB_QTY_BREAKPOINTS;
  if (qty <= pts[0][0]) {
    // Below smallest preset: extrapolate upward using the first segment's
    // slope (small orders cost more per unit), clamped to a sane ceiling.
    const [q1, m1] = pts[0];
    const [q2, m2] = pts[1];
    const slope = (m2 - m1) / (q2 - q1);
    const extrapolated = m1 + slope * (qty - q1);
    return Math.min(2.0, Math.max(extrapolated, m1));
  }

  if (qty >= pts[pts.length - 1][0]) {
    // Above largest preset: extrapolate downward using the last segment's
    // slope (bigger orders keep getting cheaper), floored so it never
    // goes to zero or negative.
    const [q1, m1] = pts[pts.length - 2];
    const [q2, m2] = pts[pts.length - 1];
    const slope = (m2 - m1) / (q2 - q1);
    const extrapolated = m2 + slope * (qty - q2);
    return Math.max(0.4, Math.min(extrapolated, m2));
  }

  // Between two known presets: straight linear interpolation.
  for (let i = 0; i < pts.length - 1; i++) {
    const [q1, m1] = pts[i];
    const [q2, m2] = pts[i + 1];
    if (qty >= q1 && qty <= q2) {
      const t = (qty - q1) / (q2 - q1);
      return m1 + t * (m2 - m1);
    }
  }

  return 1; // unreachable given the bounds checks above, but keeps TS happy
}

export const QB_METHODS = ["Screen Print", "Embroidery", "DTG"] as const;
export type QbMethod = (typeof QB_METHODS)[number];

export const QB_METHOD_MULT: Record<QbMethod, number> = {
  "Screen Print": 1.0,
  Embroidery: 1.35,
  DTG: 1.2,
};

export const QB_METHOD_DAYS: Record<QbMethod, string> = {
  "Screen Print": "5–7 business days",
  Embroidery: "7–10 business days",
  DTG: "3–5 business days",
};

export const QB_INK_SURCHARGE = 1.2;

export interface QuoteState {
  product: QbProduct;
  qty: number;
  method: QbMethod;
  ink: number;
}

export function calculateQuote(state: QuoteState) {
  const base = QB_PRODUCT_BASE[state.product];
  const qtyMult = getQtyMultiplier(state.qty);
  const methodMult = QB_METHOD_MULT[state.method];
  const perUnit =
    base * qtyMult * methodMult + QB_INK_SURCHARGE * Math.max(0, state.ink - 1);
  const total = perUnit * state.qty;

  const perUnit24 =
    base * getQtyMultiplier(24) * methodMult +
    QB_INK_SURCHARGE * Math.max(0, state.ink - 1);
  const savePct = perUnit24 > 0 ? Math.round((1 - perUnit / perUnit24) * 100) : 0;

  return {
    perUnit,
    total,
    savePct,
    turnaround: QB_METHOD_DAYS[state.method],
  };
}

export function money(n: number) {
  return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}