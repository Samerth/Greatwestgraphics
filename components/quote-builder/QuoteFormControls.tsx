"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Shared step-form building blocks for the quote builder and the PDP
 * Detailed Quote block, so both stay visually and behaviorally identical
 * instead of drifting apart as separate copies.
 */
export function QbRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-sp-4">
      <label className="block text-xs font-bold tracking-[0.1em] uppercase text-text-tertiary mb-sp-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Pill({
  children,
  active,
  round,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border font-semibold text-sm transition-all duration-200 text-left cursor-pointer",
        round
          ? "w-[38px] h-[38px] rounded-full grid place-items-center p-0 text-xs"
          : "px-4 py-2.5 rounded-md",
        active
          ? "bg-accent border-accent text-white shadow-md scale-[1.02]"
          : "bg-bg-raised border-border text-text-primary hover:border-text-secondary hover:shadow-sm hover:scale-[1.01]",
      )}
    >
      {children}
    </button>
  );
}