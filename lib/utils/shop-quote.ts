import type { DecorationMethodConfig, PricingConfigV2 } from "@gwg/contracts";

/** Colour counts the picker offers, capped so the row stays readable. */
const MAX_COLOUR_PILLS = 6;

export const STITCH_PRESETS = [
  { id: "small", stitches: 5000, label: "Small logo" },
  { id: "medium", stitches: 8000, label: "Medium logo" },
  { id: "large", stitches: 12000, label: "Large logo" },
] as const;

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
