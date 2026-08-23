"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type StudioSelectOption = {
  value: string;
  label: string;
};

type Tone = "canvas" | "panel";

const tones: Record<
  Tone,
  {
    trigger: string;
    menu: string;
    option: string;
    optionActive: string;
  }
> = {
  canvas: {
    trigger:
      "min-h-8 rounded-md border-white/15 bg-transparent px-2.5 py-1 text-[12px] font-semibold text-white/70 hover:bg-white/5 focus:ring-white/20",
    menu: "border-white/15 bg-[#1c1c1c] text-white/80",
    option: "text-white/75 hover:bg-white/10",
    optionActive: "bg-white/15 text-white",
  },
  panel: {
    trigger:
      "min-h-11 rounded-sm border-border bg-bg-raised px-3 py-2.5 text-base font-body font-semibold text-text-primary hover:border-text-tertiary focus:border-accent focus:ring-accent/20",
    menu: "border-border bg-bg-raised text-text-primary shadow-[0_12px_28px_rgba(0,0,0,0.12)]",
    option: "text-[13px] text-text-primary hover:bg-fill-subtle-15 hover:text-accent",
    optionActive: "text-[13px] bg-accent-tint text-accent",
  },
};

/**
 * In-flow listbox. Native select option sheets ignore overflow and paint
 * past the studio chrome; this menu stays the width of the trigger and
 * scrolls instead.
 */
export function StudioSelect({
  value,
  onChange,
  options,
  ariaLabel,
  tone,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly StudioSelectOption[];
  ariaLabel: string;
  tone: Tone;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const skin = tones[tone];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [value]);

  return (
    <div ref={rootRef} className={cn("relative z-10 min-w-0 max-w-full", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center gap-2 border appearance-none focus:outline-none focus:ring-1",
          skin.trigger,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.label ?? value}
        </span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          className={cn(
            "shrink-0 opacity-50 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-x-hidden overflow-y-auto rounded-md border py-1",
            skin.menu,
          )}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full min-w-0 px-2.5 py-2 text-left font-semibold",
                    active ? skin.optionActive : skin.option,
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
