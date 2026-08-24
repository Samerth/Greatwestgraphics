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
import { formatZoneInchLabel } from "@/lib/commerce/studio-zones";

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
    <div className="rounded-md border border-border bg-bg p-sp-4 flex flex-col gap-2 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
        {title} print
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
          label: formatZoneInchLabel(location),
        }))}
      />
      {value.printMethod === "embroidery" ? (
        <p className="m-0 text-[11px] leading-4 text-text-tertiary">
          Embroidery hoops are often smaller than this print plate. We will
          confirm the size before we stitch.
        </p>
      ) : null}
    </div>
  );
}

export function StudioTeamOrderPanel({
  roster,
  onRosterChange,
  sizes,
  decor,
  onDecorChange,
  rosterError,
}: {
  roster: RosterRow[];
  onRosterChange: (rows: RosterRow[]) => void;
  sizes: { id: string; label: string }[];
  decor: RosterDecor;
  onDecorChange: (target: RosterDecorTarget, patch: Partial<RosterDecorPart>) => void;
  rosterError?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div>
        <h3 className="font-display text-[18px] m-0">Team order</h3>
        <p className="m-0 mt-1 text-sm text-text-secondary max-w-[62ch]">
          One row per shirt — size, name, and number. A finished list becomes
          the order quantity. For a single name or number on one jersey, use
          the Text tab instead.
        </p>
      </div>
      <RosterEditor
        layout="wide"
        sizes={sizes}
        rows={roster}
        onChange={onRosterChange}
      />
      {rosterError ? (
        <p className="m-0 text-[12px] font-semibold text-red-600" role="alert">
          {rosterError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
    </div>
  );
}
