import { cn } from "@/lib/utils/cn";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

interface MoneyRowProps {
  label: string;
  /** A real figure to display, or `null` for something that genuinely isn't
   *  known yet (shipping, tax — neither is persisted anywhere on the job
   *  today). Passing `null` is what makes rendering "$0.00 shipping" for an
   *  unknown charge structurally impossible: there is no path from `null`
   *  to a dollar sign, only to `note`. */
  amountMinor: number | null;
  /** Shown in place of a figure when `amountMinor` is `null` — e.g.
   *  "Confirmed on the invoice." */
  note?: string;
  emphasis?: "none" | "subtotal" | "total";
  muted?: boolean;
}

export function MoneyRow({
  label,
  amountMinor,
  note,
  emphasis = "none",
  muted,
}: MoneyRowProps) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1.5",
        emphasis === "subtotal" && "border-t border-border mt-1 pt-2",
        emphasis === "total" && "border-t-2 border-text-primary mt-2 pt-2",
      )}
    >
      <span
        className={cn(
          "text-sm",
          emphasis === "total" ? "font-bold text-text-primary" : "text-text-secondary",
          muted && "text-text-tertiary",
        )}
      >
        {label}
      </span>
      {amountMinor === null ? (
        <span className="text-sm text-text-tertiary italic tabular-nums">
          {note ?? "Not yet known"}
        </span>
      ) : (
        <span
          className={cn(
            "tabular-nums",
            emphasis === "total"
              ? "text-lg font-bold text-text-primary"
              : emphasis === "subtotal"
                ? "font-bold text-text-primary"
                : "text-text-primary",
            muted && "text-text-tertiary",
          )}
        >
          {moneyFromMinor(amountMinor)}
        </span>
      )}
    </div>
  );
}
