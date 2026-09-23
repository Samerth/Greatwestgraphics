import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DataListProps {
  columns?: 1 | 2;
  className?: string;
  children: ReactNode;
}

/** A `<dl>` grid — label small and quiet above, value clear below. This is
 *  the direct fix for the client's "everything has the same visual weight"
 *  complaint: a label in prose reads the same size as the thing it's
 *  labelling, a `DataRow` deliberately does not. */
export function DataList({ columns = 1, className, children }: DataListProps) {
  return (
    <dl
      className={cn(
        "m-0 grid gap-x-sp-4 gap-y-sp-3",
        columns === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </dl>
  );
}

interface DataRowProps {
  label: ReactNode;
  children: ReactNode;
  /** A figure the reader should land on first — the total, the requested
   *  date. Renders the value larger. */
  emphasis?: boolean;
  /** Numbers/codes that should line up in a column — money, SKUs, dates. */
  mono?: boolean;
  className?: string;
}

export function DataRow({ label, children, emphasis, mono, className }: DataRowProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 mt-0.5 text-text-primary",
          emphasis ? "text-base font-bold" : "text-sm font-semibold",
          mono && "tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
