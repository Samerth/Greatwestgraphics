"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { studioColorwayFill } from "@/lib/commerce/studio-garments";
import {
  CATALOG_SWATCH_WINDOW,
  catalogSwatchWindow,
  nextCatalogSwatchStart,
  prevCatalogSwatchStart,
} from "@/lib/commerce/catalog-swatches";

export type CatalogColorSwatch = {
  colorName: string;
  imageUrl: string | null;
  colorHex: string | null;
  productId: string;
  slug: string;
};

type Props = {
  swatches: CatalogColorSwatch[];
  colorwayCount: number;
  visible?: number;
  onActiveChange?: (swatch: CatalogColorSwatch | null) => void;
};

export function CatalogColorSwatches({
  swatches,
  colorwayCount,
  visible = CATALOG_SWATCH_WINDOW,
  onActiveChange,
}: Props) {
  const [windowStart, setWindowStart] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (swatches.length === 0) return null;

  const total = swatches.length;
  const page = catalogSwatchWindow(total, windowStart, visible);
  const visibleSwatches = swatches.slice(page.start, page.end);
  const remaining = Math.max(page.remaining, colorwayCount - page.end);
  const activeIdx = hoveredIdx ?? selectedIdx;
  const activeSwatch = activeIdx != null ? swatches[activeIdx] : null;

  function emit(nextHovered: number | null, nextSelected = selectedIdx) {
    const idx = nextHovered ?? nextSelected;
    onActiveChange?.(idx == null ? null : (swatches[idx] ?? null));
  }

  function goTo(nextStart: number) {
    setWindowStart(nextStart);
    setHoveredIdx(null);
    emit(null);
  }

  return (
    <div className="mb-1.5">
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => {
          setHoveredIdx(null);
          emit(null);
        }}
      >
        {page.canPrev ? (
          <button
            type="button"
            aria-label="Previous colours"
            onClick={() => goTo(prevCatalogSwatchStart(total, page.start, visible))}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:text-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {visibleSwatches.map((swatch, offset) => {
          const i = page.start + offset;
          const fill = studioColorwayFill({
            id: swatch.productId,
            colorName: swatch.colorName,
            hex: swatch.colorHex ?? undefined,
            swatchImageUrl: swatch.imageUrl ?? undefined,
          });
          return (
            <button
              key={`${swatch.productId}-${swatch.colorName}`}
              type="button"
              title={swatch.colorName}
              aria-label={`View in ${swatch.colorName}`}
              aria-pressed={selectedIdx === i}
              onMouseEnter={() => {
                setHoveredIdx(i);
                emit(i);
              }}
              onFocus={() => {
                setHoveredIdx(i);
                emit(i);
              }}
              onBlur={() => {
                setHoveredIdx(null);
                emit(null);
              }}
              onClick={() => {
                const next = selectedIdx === i ? null : i;
                setSelectedIdx(next);
                emit(hoveredIdx, next);
              }}
              className={cn(
                "relative w-4 h-4 rounded-full border overflow-hidden bg-bg shrink-0 transition-shadow",
                activeIdx === i
                  ? "border-accent ring-2 ring-accent ring-offset-1"
                  : "border-border hover:border-accent",
              )}
            >
              {fill.hex ? (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ backgroundColor: fill.hex }}
                />
              ) : (
                fill.imageUrl && (
                  <Image
                    src={fill.imageUrl}
                    alt={swatch.colorName}
                    fill
                    className="object-cover"
                    sizes="16px"
                  />
                )
              )}
            </button>
          );
        })}

        {page.canNext ? (
          <button
            type="button"
            aria-label={
              remaining > 0
                ? `Next colours, ${remaining} more`
                : "Next colours"
            }
            onClick={() => goTo(nextCatalogSwatchStart(total, page.start, visible))}
            className="flex items-center gap-0.5 text-[11px] font-semibold text-text-tertiary hover:text-accent"
          >
            {remaining > 0 ? `+${remaining}` : null}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {activeSwatch ? (
        <p className="m-0 mt-1 text-[11px] leading-4 text-text-tertiary">
          {activeSwatch.colorName}
        </p>
      ) : null}
    </div>
  );
}
