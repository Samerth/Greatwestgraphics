"use client";

import { STUDIO_TEXT_SWATCHES } from "@/lib/commerce/studio-fonts";
import { cn } from "@/lib/utils/cn";

export function StudioColorSwatches({
  value,
  onChange,
  ariaLabel = "Colour",
}: {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STUDIO_TEXT_SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`${ariaLabel} ${hex}`}
          onClick={() => onChange(hex)}
          className={cn(
            "h-7 w-7 rounded-full border transition-transform",
            value.toLowerCase() === hex
              ? "border-accent ring-2 ring-accent/40 scale-105"
              : "border-black/20 hover:scale-105",
          )}
          style={{ background: hex }}
        />
      ))}
      <label className="relative h-7 w-7 overflow-hidden rounded-full border border-dashed border-text-tertiary">
        <span className="sr-only">{ariaLabel} custom</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: value }}
        />
      </label>
    </div>
  );
}
