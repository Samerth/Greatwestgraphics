"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESIGN_CANVAS_SIZE,
  DESIGN_SIDE_LABELS,
  type DesignDocument,
  type DesignSide,
} from "@gwg/contracts";
import { DesignSidePreview } from "@/components/design/DesignSidePreview";
import { cn } from "@/lib/utils/cn";

/**
 * One large, correctly-scaled view of the finished design, with a tab per
 * decorated location.
 *
 * `DesignSidePreview` draws at a fixed `DESIGN_CANVAS_SIZE` box and clips
 * anything outside it, so dropping it into a narrower column silently shows
 * a cropped corner of the garment rather than shrinking it. Measuring the
 * available width and handing it down as `size` is what keeps the whole
 * garment visible at any column width.
 */
export function DesignPreviewViewer({
  design,
  sides,
  imageForSide,
  className,
}: {
  design: DesignDocument;
  /** Decorated locations, in the order they should be offered. */
  sides: DesignSide[];
  imageForSide: (side: DesignSide) => string | null;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DESIGN_CANVAS_SIZE);
  const [active, setActive] = useState<DesignSide | null>(sides[0] ?? null);

  // Keep the shown side valid as the design changes — clearing artwork off
  // the active side must not leave the viewer pointing at nothing.
  useEffect(() => {
    if (sides.length === 0) {
      setActive(null);
    } else if (!active || !sides.includes(active)) {
      setActive(sides[0]!);
    }
  }, [sides, active]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(120, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tabs = useMemo(
    () => sides.map((side) => ({ side, label: DESIGN_SIDE_LABELS[side] })),
    [sides],
  );

  if (!active) return null;

  return (
    <div className={className}>
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Design views"
          className="flex flex-wrap gap-1 mb-2"
        >
          {tabs.map((tab) => (
            <button
              key={tab.side}
              type="button"
              role="tab"
              aria-selected={active === tab.side}
              onClick={() => setActive(tab.side)}
              className={cn(
                "px-2.5 py-1 rounded-sm border text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
                active === tab.side
                  ? "bg-accent text-white border-accent"
                  : "border-border text-text-secondary hover:border-text-tertiary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div
        ref={boxRef}
        className="w-full rounded-md border border-border bg-white overflow-hidden"
      >
        <DesignSidePreview
          side={active}
          design={design}
          garmentImageUrl={imageForSide(active)}
          size={width}
        />
      </div>

      <p className="mt-1.5 mb-0 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
        {DESIGN_SIDE_LABELS[active]}
      </p>
    </div>
  );
}
