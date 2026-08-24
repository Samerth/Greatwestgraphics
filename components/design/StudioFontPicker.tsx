"use client";

import { STUDIO_FONTS } from "@/lib/commerce/studio-fonts";
import { cn } from "@/lib/utils/cn";

export function StudioFontPicker({
  value,
  onChange,
  sample = "Great West",
  tone = "panel",
}: {
  value: string;
  onChange: (fontId: string) => void;
  sample?: string;
  tone?: "panel" | "canvas";
}) {
  const canvas = tone === "canvas";
  return (
    <div
      role="listbox"
      aria-label="Font"
      className={cn(
        "max-h-48 overflow-y-auto rounded-md border",
        canvas ? "border-white/15 bg-black/30" : "border-border bg-bg",
      )}
    >
      {STUDIO_FONTS.map((font) => {
        const active = font.id === value;
        return (
          <button
            key={font.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onChange(font.id)}
            className={cn(
              "flex w-full min-w-0 items-baseline justify-between gap-2 px-2.5 py-1.5 text-left transition-colors",
              active
                ? canvas
                  ? "bg-white/15 text-white"
                  : "bg-accent-tint text-accent"
                : canvas
                  ? "text-white/80 hover:bg-white/10"
                  : "text-text-primary hover:bg-fill-subtle-15",
            )}
          >
            <span
              className="min-w-0 truncate text-[15px] leading-6"
              style={{ fontFamily: font.family }}
            >
              {sample}
            </span>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] opacity-55">
              {font.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
