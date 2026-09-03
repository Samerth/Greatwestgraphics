"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type DesignStepId = "design" | "quantity" | "review";

const STEPS: { id: DesignStepId; label: string; href: string }[] = [
  { id: "design", label: "Design", href: "/design" },
  { id: "quantity", label: "Input Quantity", href: "/design/quantity" },
  { id: "review", label: "Review & Pay", href: "/cart" },
];

export function DesignStepBar({
  current,
  /** How far the customer has actually got. A step is only navigable once
   *  it has been reached — linking into the quantity page before there is
   *  a design to price would strand them on an empty screen, which is the
   *  failure the sequential flow exists to prevent. */
  reached,
  className,
}: {
  current: DesignStepId;
  reached: DesignStepId;
  className?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  const reachedIndex = STEPS.findIndex((s) => s.id === reached);

  return (
    <nav aria-label="Design progress" className={className}>
      <ol className="flex items-center gap-1 sm:gap-2 flex-wrap m-0 p-0 list-none">
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isDone = i < currentIndex;
          const isNavigable = i <= reachedIndex && !isCurrent;

          const marker = (
            <span
              className={cn(
                "grid place-items-center h-6 w-6 shrink-0 rounded-full text-[11px] font-bold leading-none transition-colors",
                isCurrent && "bg-accent text-white",
                isDone && "bg-emerald-500 text-white",
                !isCurrent && !isDone && "border border-border text-text-tertiary",
              )}
            >
              {isDone ? "✓" : i + 1}
            </span>
          );

          const label = (
            <span
              className={cn(
                "text-[13px] font-bold whitespace-nowrap",
                isCurrent && "text-text-primary",
                !isCurrent && isNavigable && "text-text-secondary",
                !isCurrent && !isNavigable && "text-text-tertiary",
              )}
            >
              {step.label}
            </span>
          );

          return (
            <li key={step.id} className="flex items-center gap-1 sm:gap-2">
              {isNavigable ? (
                <Link
                  href={step.href}
                  className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-0.5 hover:bg-fill-subtle-15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
                >
                  {marker}
                  {label}
                </Link>
              ) : (
                <span
                  className="flex items-center gap-2 px-1.5 py-1"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {marker}
                  {label}
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-4 sm:w-8 shrink-0",
                    i < currentIndex ? "bg-emerald-400" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
