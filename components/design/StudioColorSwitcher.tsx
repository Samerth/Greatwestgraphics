"use client";

import { StudioSelect } from "@/components/design/StudioSelect";
import {
  studioColorwayFill,
  studioColorwaysUseSwatches,
  type StudioColorwayOption,
} from "@/lib/commerce/studio-garments";
import { cn } from "@/lib/utils/cn";

type Tone = "canvas" | "panel";

export function StudioColorSwitcher({
  colorways,
  selectedId,
  onChange,
  tone,
}: {
  colorways: readonly StudioColorwayOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
  tone: Tone;
}) {
  if (colorways.length === 0) return null;

  const selected = colorways.find((colorway) => colorway.id === selectedId);
  const canvas = tone === "canvas";
  const useSwatches = studioColorwaysUseSwatches(colorways);

  return (
    <div className="min-w-0">
      <span
        className={cn(
          "block text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5",
          canvas ? "text-white/45" : "text-text-tertiary",
        )}
      >
        Garment color
        {selected ? (
          <span
            className={cn(
              "ml-1.5 normal-case tracking-normal font-semibold",
              canvas ? "text-white/80" : "text-text-primary",
            )}
          >
            {selected.colorName}
          </span>
        ) : null}
      </span>
      {useSwatches ? (
        <div
          role="radiogroup"
          aria-label="Garment color"
          className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto"
        >
          {colorways.map((colorway) => {
            const active = colorway.id === selectedId;
            const fill = studioColorwayFill(colorway);
            return (
              <button
                key={colorway.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={colorway.colorName}
                aria-label={colorway.colorName}
                onClick={() => onChange(colorway.id)}
                className={cn(
                  "relative h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                  active
                    ? "border-accent"
                    : canvas
                      ? "border-white/20 hover:border-white/50"
                      : "border-border hover:border-text-tertiary",
                )}
              >
                {fill.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny vendor swatch; no optimizer needed
                  <img
                    src={fill.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="absolute inset-0"
                    style={{
                      backgroundColor: fill.hex ?? (canvas ? "#3a3a3a" : "#e7e5e4"),
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <StudioSelect
          tone={tone}
          ariaLabel="Garment color"
          value={selectedId ?? ""}
          onChange={(id) => {
            if (id) onChange(id);
          }}
          options={colorways.map((colorway) => ({
            value: colorway.id,
            label: colorway.colorName,
          }))}
        />
      )}
    </div>
  );
}
