import type { DecorationMethodConfig, PricingConfigV2 } from "@gwg/contracts";

/** Colour counts the picker offers, capped so the row stays readable. */
const MAX_COLOUR_PILLS = 6;

/**
 * Shared print/embroidery locations. Single source of truth so the PDP
 * quote block and the quote builder can't drift into different label sets.
 */
export const LOCATIONS = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "leftChest", label: "Left chest" },
  { id: "sleeve", label: "Sleeve" },
] as const;

export type LocationId = (typeof LOCATIONS)[number]["id"];

/**
 * Narrows the location list down to an admin allow-list (CodSphere UAT —
 * "Product-Specific Decoration Methods & Print Locations", e.g. Bags should
 * not offer sleeve/chest placements). `null`/empty means unrestricted —
 * every location stays available, today's behaviour.
 */
export function filterAllowedLocations<T extends { id: string }>(
  locations: readonly T[],
  allowedIds: string[] | null | undefined,
): T[] {
  if (!allowedIds || allowedIds.length === 0) return [...locations];
  const allowed = new Set(allowedIds);
  return locations.filter((l) => allowed.has(l.id));
}

// Customer-facing embroidery tiers, mapped to the stitch-count pricing
// engine already uses (CodSphere UAT V2): Small ≤5,000 / Medium 5,001–10,000
// / Large 10,001–15,000 / Oversized 15,000+. Each `stitches` value is what
// actually gets priced for that tier, so it must sit inside its band — Large
// and Oversized previously both passed 15000, which collapsed them into an
// identical price. Oversized now prices at a representative stitch count
// above the Large ceiling instead of repeating it.
export const STITCH_PRESETS = [
  {
    id: "small",
    stitches: 5000,
    label: "Small logo",
    dimensionGuide: "Up to approximately 4\" — left chest, cap front",
  },
  {
    id: "medium",
    stitches: 10000,
    label: "Medium logo",
    dimensionGuide: "Approximately 4\"–8\" — chest or sleeve",
  },
  {
    id: "large",
    stitches: 15000,
    label: "Large logo",
    dimensionGuide: "Approximately 8\"–12\" — back or full front",
  },
  {
    id: "oversized",
    stitches: 20000,
    label: "Oversized",
    dimensionGuide: "Approximately 12\"+ — large back designs",
  },
] as const;

export const STITCH_PRESET_DISCLAIMER =
  "Embroidery pricing shown is an estimate based on the selected artwork tier. Final stitch count and pricing will be confirmed after artwork review/digitizing. Any required pricing adjustment will be confirmed before production.";

export type StitchPresetId = (typeof STITCH_PRESETS)[number]["id"];

/** Which extra question to ask, decided by the method's rate model. */
export function methodVariableInputs(method: DecorationMethodConfig | undefined) {
  return {
    colours: method?.rateModel.kind === "matrixByColour",
    stitches: method?.rateModel.kind === "baseWithVariable",
    option: method?.rateModel.kind === "matrixByOption",
  };
}

export function enabledDecorationMethods(config: PricingConfigV2) {
  return [...config.methods]
    .filter((entry) => entry.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function defaultOptionKey(method: DecorationMethodConfig | undefined): string {
  if (method?.rateModel.kind !== "matrixByOption") return "";
  const options = method.rateModel.options;
  return (options[Math.min(1, options.length - 1)] ?? options[0])?.key ?? "";
}

export function colourOptions(method: DecorationMethodConfig | undefined): number[] {
  if (method?.rateModel.kind !== "matrixByColour") return [];
  const { minColours, maxColours } = method.rateModel;
  const options: number[] = [];
  for (
    let count = minColours;
    count <= Math.min(maxColours, minColours + MAX_COLOUR_PILLS - 1);
    count += 1
  ) {
    options.push(count);
  }
  return options;
}

export function stitchCountForPreset(preset: StitchPresetId): number {
  return STITCH_PRESETS.find((entry) => entry.id === preset)?.stitches ?? 8000;
}
