import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/lib/commerce/status";

const TONE_BORDER: Partial<Record<StatusTone, string>> = {
  warning: "border-amber-300",
  danger: "border-red-300",
  success: "border-green-300",
};

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
  /** Spans two columns in the summary grid — for a value too long to sit
   *  comfortably in one tile, like a full shipping address line. */
  wide?: boolean;
}

/** One fact from the Order Summary strip — Job #, quantity, order total,
 *  requested date, and so on. The client's point 1 asked for exactly this:
 *  "the most important information visible without scrolling." Quiet label
 *  on top, the actual answer large underneath. */
export function StatTile({ label, value, hint, tone, wide }: StatTileProps) {
  return (
    <div
      className={cn(
        "border rounded-md bg-bg-raised px-sp-3 py-sp-3",
        tone && TONE_BORDER[tone] ? TONE_BORDER[tone] : "border-border",
        wide && "sm:col-span-2",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
        {label}
      </p>
      <p className="font-display font-bold text-xl leading-tight tabular-nums m-0 mt-1">
        {value}
      </p>
      {hint && (
        <p className="text-xs text-text-tertiary m-0 mt-1">{hint}</p>
      )}
    </div>
  );
}
