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

export const STITCH_PRESETS = [
  {
    id: "small",
    stitches: 5000,
    label: "Small logo",
    dimensionGuide: "Up to about 3\" wide — left chest, cap front",
  },
  {
    id: "medium",
    stitches: 10000,
    label: "Medium logo",
    dimensionGuide: "About 3\"–5\" wide — chest or sleeve",
  },
  {
    id: "large",
    stitches: 15000,
    label: "Large logo",
    dimensionGuide: "About 5\"–7\" wide — back or full front",
  },
  {
    id: "oversized",
    stitches: 15000,
    label: "Oversized",
    dimensionGuide: "7\"+ wide — large back designs",
  },
] as const;

export const STITCH_PRESET_DISCLAIMER =
  "Stitch count is an estimate. Dense, highly detailed, or lettered artwork can push a design into a higher tier — we'll confirm the exact count after digitizing and before production.";

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
