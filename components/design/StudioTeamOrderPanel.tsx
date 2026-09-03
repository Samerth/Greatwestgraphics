"use client";

import type { RosterDecor, RosterDecorPart } from "@gwg/contracts";
import { RosterEditor, type RosterRow } from "@/components/shared/RosterEditor";
import { StudioColorSwatches } from "@/components/design/StudioColorSwatches";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { StudioSelect } from "@/components/design/StudioSelect";
import {
  ROSTER_DECOR_LOCATIONS,
  ROSTER_DECOR_PRINT_METHODS,
  type RosterDecorTarget,
} from "@/lib/commerce/studio-roster-decor";
import { formatZoneInchLabel } from "@/lib/commerce/studio-zones";
import { cn } from "@/lib/utils/cn";

function DecorFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: RosterDecorPart;
  onChange: (patch: Partial<RosterDecorPart>) => void;
}) {
  const enabled = value.enabled;
  return (
    <div
      className={cn(
        "rounded-md border p-sp-4 flex flex-col gap-2 min-w-0 transition-colors",
        enabled ? "border-border bg-bg" : "border-border bg-fill-subtle-15",
      )}
    >
      {/* Matches the Coastal Reign benchmark exactly: a checkbox per mark,
          off by default expectation aside — ours defaults on to keep typing
          a roster row still showing a live preview with zero extra clicks —
          with everything below staying visible but inert while off, so
          Location/Height can be set up in advance of turning it on. */}
      <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        {title} print
      </label>
      <fieldset
        disabled={!enabled}
        className={cn(
          "contents",
          !enabled && "opacity-50",
        )}
      >
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
      </fieldset>
      {/* Only shown once the mark has actually been dragged — a button that
          is always present but does nothing until you have moved something
          reads as broken. This is the fast way back after a stray drag,
          without hunting for the right spot by hand. */}
      {enabled && (value.offsetXNorm !== 0 || value.offsetYNorm !== 0) && (
        <button
          type="button"
          onClick={() => onChange({ offsetXNorm: 0, offsetYNorm: 0 })}
          className="self-start text-[11px] font-bold text-accent hover:underline"
        >
          Reset position
        </button>
      )}
      {enabled && value.printMethod === "embroidery" ? (
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
  namesNumbersFeeMinor = 0,
}: {
  roster: RosterRow[];
  onRosterChange: (rows: RosterRow[]) => void;
  sizes: { id: string; label: string }[];
  decor: RosterDecor;
  onDecorChange: (target: RosterDecorTarget, patch: Partial<RosterDecorPart>) => void;
  rosterError?: string | null;
  /** Per-garment charge for personalising with a name and/or number, from
   *  the published pricing config. Shown here so the cost is visible where
   *  the decision is made, not discovered at checkout. */
  namesNumbersFeeMinor?: number;
}) {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div>
        <h3 className="font-display text-[18px] m-0">Names &amp; numbers</h3>
        <p className="m-0 mt-1 text-sm text-text-secondary max-w-[62ch]">
          One row per shirt — the name and number printed on it. You will
          choose each person&apos;s size on the next step, with the rest of
          your quantities. For a single name or number on one jersey, use the
          Text tab instead.
        </p>
        <p className="m-0 mt-1 text-sm text-text-secondary max-w-[62ch]">
          The example text on the garment shows where these will print — drag
          or resize it directly, or use the controls below for exact
          numbers. Uncheck either one if you only want names, or only
          numbers.
        </p>
        {namesNumbersFeeMinor > 0 && (
          <p className="m-0 mt-2 text-sm font-semibold text-text-primary">
            {moneyFromMinor(namesNumbersFeeMinor)} per garment to personalise
            with a name and/or number.{" "}
            <span className="font-normal text-text-secondary">
              Applied to every piece on this list.
            </span>
          </p>
        )}
      </div>
      <RosterEditor
        layout="wide"
        showSize={false}
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
