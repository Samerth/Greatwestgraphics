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
