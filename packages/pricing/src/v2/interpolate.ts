/**
 * Quantity interpolation shared by every rate model.
 *
 * The estimator workbook treats a tier price as the price *at the first
 * quantity of that tier* and draws a straight line to the next tier, so a
 * 36-piece order lands between the 24 and 48 rates instead of paying the 24
 * rate. Above the top anchor the rate goes flat.
 */

export type InterpolationResult = {
  value: number;
  lowAnchor: number;
  highAnchor: number;
  lowValue: number;
  highValue: number;
  /** 0 at the low anchor, 1 at the high anchor. */
  fraction: number;
  isFlat: boolean;
};

export function interpolateByAnchor(
  anchors: readonly number[],
  values: readonly number[],
  at: number,
): InterpolationResult {
  if (anchors.length === 0 || anchors.length !== values.length) {
    throw new Error("Interpolation anchors and values must align");
  }

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;

  if (at <= first) {
    return {
      value: values[0]!,
      lowAnchor: first,
      highAnchor: first,
      lowValue: values[0]!,
      highValue: values[0]!,
      fraction: 0,
      isFlat: true,
    };
  }
  if (at >= last) {
    const value = values[values.length - 1]!;
    return {
      value,
      lowAnchor: last,
      highAnchor: last,
      lowValue: value,
      highValue: value,
      fraction: 0,
      isFlat: true,
    };
  }

  let lowIndex = 0;
  while (lowIndex < anchors.length - 1 && anchors[lowIndex + 1]! <= at) {
    lowIndex += 1;
  }
  const highIndex = Math.min(lowIndex + 1, anchors.length - 1);

  const lowAnchor = anchors[lowIndex]!;
  const highAnchor = anchors[highIndex]!;
  const lowValue = values[lowIndex]!;
  const highValue = values[highIndex]!;
  const fraction =
    highAnchor === lowAnchor ? 0 : (at - lowAnchor) / (highAnchor - lowAnchor);

  return {
    value: lowValue + fraction * (highValue - lowValue),
    lowAnchor,
    highAnchor,
    lowValue,
    highValue,
    fraction,
    isFlat: false,
  };
}

/** Round half away from zero, for money held as fractional cents. */
export function roundMinor(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5 + 1e-9);
}

export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const amount = (Math.abs(minor) / 100).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${amount}`;
}

/**
 * Rates can land on fractions of a cent after interpolation, so they show the
 * extra precision when it exists and plain dollars-and-cents when it doesn't.
 */
export function formatRate(minor: number): string {
  const isWholeCent = Math.abs(minor - Math.round(minor)) < 1e-9;
  if (isWholeCent) return `$${(minor / 100).toFixed(2)}`;
  return `$${(minor / 100).toFixed(4).replace(/0+$/, "")}`;
}

/**
 * Split a total across weights so the integer parts still sum to the total.
 * Used for sharing one setup fee across the garments that use a logo.
 */
export function allocateByWeight(
  totalMinor: number,
  weights: readonly number[],
): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (totalMinor * weight) / weightSum);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = totalMinor - floored.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floored];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] = result[index]! + 1;
    remainder -= 1;
  }
  return result;
}
