"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import {
  RUSH_DATE_PROMPT,
  RUSH_DISCLAIMER,
  RUSH_TURNAROUND_LABEL,
  STANDARD_TURNAROUND_LABEL,
  STANDARD_TURNAROUND_NOTE,
  earliestRushDate,
  type TurnaroundKind,
} from "@/lib/schemas/checkout";

export type TurnaroundSelection = {
  kind: TurnaroundKind;
  requestedDate?: string;
};

/**
 * Production turnaround (CodSphere UAT V2 row 50).
 *
 * Deliberately its own step, kept clear of shipping and pickup. The one rule
 * that shapes everything here: a rush is a *request*, not a purchase. No fee
 * is shown, calculated or charged — staff confirm the date and any charge
 * afterwards — so the customer is told plainly that picking a date does not
 * secure it.
 */
export function TurnaroundStep({
  defaultValue,
  onNext,
  onBack,
  nextLabel,
}: {
  defaultValue: TurnaroundSelection;
  onNext: (value: TurnaroundSelection) => void;
  onBack: () => void;
  nextLabel: string;
}) {
  const [kind, setKind] = useState<TurnaroundKind>(defaultValue.kind);
  const [requestedDate, setRequestedDate] = useState(
    defaultValue.requestedDate ?? "",
  );
  const [touched, setTouched] = useState(false);
  const dateInputId = useId();
  const minDate = earliestRushDate();

  const missingDate = kind === "rush" && !requestedDate;

  function submit() {
    if (missingDate) {
      setTouched(true);
      return;
    }
    onNext(
      kind === "rush"
        ? { kind, requestedDate }
        : // A standard order carries no date: leaving a stale one behind
          // would put a deadline on a job nobody asked to rush.
          { kind: "standard" },
    );
  }

  const OPTIONS: {
    key: TurnaroundKind;
    label: string;
    note: string;
  }[] = [
    {
      key: "standard",
      label: STANDARD_TURNAROUND_LABEL,
      note: STANDARD_TURNAROUND_NOTE,
    },
    {
      key: "rush",
      label: RUSH_TURNAROUND_LABEL,
      note: "We will confirm availability and any charge with you.",
    },
  ];

  return (
    <div data-checkout="turnaround-step">
      <h2 className="font-display font-bold text-header mb-sp-2">Turnaround</h2>
      <p className="text-sm text-text-secondary mt-0 mb-sp-4">
        How quickly the order needs to be produced. This is separate from how
        it reaches you.
      </p>

      {OPTIONS.map((option) => (
        <div key={option.key} className="mb-2.5">
          <button
            type="button"
            onClick={() => setKind(option.key)}
            aria-pressed={kind === option.key}
            className={cn(
              "w-full border rounded-md p-sp-3 flex items-start gap-sp-3 text-left transition-colors",
              kind === option.key
                ? "border-accent bg-accent-tint"
                : "border-border hover:border-text-tertiary",
            )}
          >
            <span
              className={cn(
                "w-[18px] h-[18px] rounded-full border-2 relative shrink-0 mt-0.5",
                kind === option.key ? "border-accent" : "border-border",
              )}
            >
              {kind === option.key && (
                <span className="absolute inset-[3px] rounded-full bg-accent" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-[14.5px]">
                {option.label}
              </span>
              <span className="block text-[13px] text-text-secondary">
                {option.note}
              </span>
            </span>
          </button>

          {/* Expands under the option it belongs to, so the date is visibly
              part of the rush request rather than a stray field. */}
          {option.key === "rush" && kind === "rush" && (
            <div
              data-checkout="rush-details"
              className="mt-2 rounded-md border border-border bg-bg-raised p-sp-3"
            >
              <label
                htmlFor={dateInputId}
                className="block text-sm font-semibold mb-1.5"
              >
                {RUSH_DATE_PROMPT}
              </label>
              <input
                id={dateInputId}
                type="date"
                value={requestedDate}
                min={minDate}
                onChange={(event) => setRequestedDate(event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && missingDate}
                aria-describedby={`${dateInputId}-disclaimer`}
                className="w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
              />
              {touched && missingDate && (
                <p className="mt-1.5 mb-0 text-[12.5px] font-semibold text-red-600" role="alert">
                  Choose the date you need the order by.
                </p>
              )}
              <p
                id={`${dateInputId}-disclaimer`}
                className="mt-2 mb-0 text-[12.5px] leading-snug text-text-tertiary"
              >
                {RUSH_DISCLAIMER}
              </p>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-between mt-sp-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={submit}>{nextLabel}</Button>
      </div>
    </div>
  );
}
