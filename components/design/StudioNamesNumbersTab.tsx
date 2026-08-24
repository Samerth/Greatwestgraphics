"use client";

import type { RosterDecor, RosterDecorPart } from "@gwg/contracts";
import { RosterEditor, type RosterRow } from "@/components/shared/RosterEditor";
import { StudioColorSwatches } from "@/components/design/StudioColorSwatches";
import { StudioSelect } from "@/components/design/StudioSelect";
import {
  ROSTER_DECOR_LOCATIONS,
  ROSTER_DECOR_PRINT_METHODS,
  type RosterDecorTarget,
} from "@/lib/commerce/studio-roster-decor";

function DecorFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: RosterDecorPart;
  onChange: (patch: Partial<RosterDecorPart>) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-bg p-sp-3 flex flex-col gap-2 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
        {title}
      </span>
      <StudioSelect
        tone="panel"
        ariaLabel={`${title} print method`}
        value={value.printMethod}
        onChange={(next) =>
          onChange({
            printMethod: next === "embroidery" ? "embroidery" : "print",
          })
        }
        options={ROSTER_DECOR_PRINT_METHODS.map((method) => ({
          value: method.value,
          label: method.label,
        }))}
      />
      <label className="block text-[11px] font-bold text-text-tertiary">
        Height (inches)
        <input
          type="number"
          min={0.5}
          max={12}
          step={0.25}
          value={value.heightIn}
          onChange={(event) =>
            onChange({ heightIn: Number(event.target.value) || value.heightIn })
          }
          className="mt-1 w-full min-h-10 rounded-sm border border-border bg-bg-raised px-2.5 py-2 text-sm"
        />
      </label>
      <span className="text-[11px] font-bold text-text-tertiary">Colour</span>
      <StudioColorSwatches
        value={value.color}
        onChange={(color) => onChange({ color })}
        ariaLabel={`${title} colour`}
      />
      <StudioSelect
        tone="panel"
        ariaLabel={`${title} location`}
        value={value.location}
        onChange={(location) => onChange({ location })}
        options={ROSTER_DECOR_LOCATIONS.map((location) => ({
          value: location,
          label: location,
        }))}
      />
    </div>
  );
}

export function StudioNamesNumbersTab({
  roster,
  onRosterChange,
  sizes,
  decor,
  onDecorChange,
}: {
  roster: RosterRow[];
  onRosterChange: (rows: RosterRow[]) => void;
  sizes: { id: string; label: string }[];
  decor: RosterDecor;
  onDecorChange: (target: RosterDecorTarget, patch: Partial<RosterDecorPart>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <p className="m-0 text-[11px] leading-4 text-text-tertiary">
        Names and numbers are configured separately. The roster travels with
        the design and the cart line.
      </p>
      <RosterEditor sizes={sizes} rows={roster} onChange={onRosterChange} />
      <DecorFields
        title="Names"
        value={decor.names}
        onChange={(patch) => onDecorChange("names", patch)}
      />
      <DecorFields
        title="Numbers"
        value={decor.numbers}
        onChange={(patch) => onDecorChange("numbers", patch)}
      />
    </div>
  );
}
