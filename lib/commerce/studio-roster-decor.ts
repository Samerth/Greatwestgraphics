import {
  defaultRosterDecor,
  type RosterDecor,
  type RosterDecorPart,
  type TextPrintMethod,
} from "@gwg/contracts";

export type RosterDecorTarget = "names" | "numbers";

export function patchRosterDecor(
  current: RosterDecor,
  target: RosterDecorTarget,
  patch: Partial<RosterDecorPart>,
): RosterDecor {
  return {
    names:
      target === "names" ? { ...current.names, ...patch } : { ...current.names },
    numbers:
      target === "numbers"
        ? { ...current.numbers, ...patch }
        : { ...current.numbers },
  };
}

export const ROSTER_DECOR_PRINT_METHODS: { value: TextPrintMethod; label: string }[] =
  [
    { value: "print", label: "Print" },
    { value: "embroidery", label: "Embroidery" },
  ];

export const ROSTER_DECOR_LOCATIONS = [
  "Left Chest",
  "Center Chest",
  "Right Chest",
  "Full Front",
  "Upper Back",
  "Full Back",
  "Left Sleeve",
  "Right Sleeve",
] as const;

export function rosterDecorSummary(decor: RosterDecor): string {
  const nameBit = `Names ${decor.names.heightIn}" ${decor.names.printMethod} @ ${decor.names.location}`;
  const numberBit = `Numbers ${decor.numbers.heightIn}" ${decor.numbers.printMethod} @ ${decor.numbers.location}`;
  return `${nameBit} · ${numberBit}`;
}

export function emptyRosterDecor(): RosterDecor {
  return defaultRosterDecor();
}
