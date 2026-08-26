"use client";

import { useEffect, useRef } from "react";
import type { SizeSpecChart } from "@/lib/utils/size-specs";

export interface StudioSizeChartModalProps {
  chart: SizeSpecChart;
  productName: string;
  onClose: () => void;
}

/**
 * Size chart modal for the Design Studio.
 *
 * Renders the same measurement table as the PDP's `ProductSizeSpecs`
 * section, but as an in-place overlay. The "Size chart" link used to point
 * at `/product/[slug]#size-chart`, which navigated the shopper off the
 * studio entirely -- abandoning their in-progress design -- just to show a
 * table that lives happily inline. z-[80]/[81] sit above the sticky header
 * (z-[60]), the highest z-index anywhere else in the app.
 */
export function StudioSizeChartModal({
  chart,
  productName,
  onClose,
}: StudioSizeChartModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // The studio layout has its own internal scroll containers (the sidebar,
  // the element editor panel) that scroll independently of <body>, so the
  // body-overflow lock below doesn't stop wheel/touch/keyboard scrolling
  // behind the modal. Block those events globally, letting them through
  // only when they originate inside the modal panel itself.
  useEffect(() => {
    const isInsidePanel = (target: EventTarget | null) =>
      target instanceof Node && panelRef.current?.contains(target);

    const blockWheelAndTouch = (e: WheelEvent | TouchEvent) => {
      if (!isInsidePanel(e.target)) e.preventDefault();
    };

    const scrollKeys = new Set([
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
    ]);
    const blockScrollKeys = (e: KeyboardEvent) => {
      if (scrollKeys.has(e.key) && !isInsidePanel(e.target)) e.preventDefault();
    };

    window.addEventListener("wheel", blockWheelAndTouch, { passive: false });
    window.addEventListener("touchmove", blockWheelAndTouch, { passive: false });
    window.addEventListener("keydown", blockScrollKeys);
    return () => {
      window.removeEventListener("wheel", blockWheelAndTouch);
      window.removeEventListener("touchmove", blockWheelAndTouch);
      window.removeEventListener("keydown", blockScrollKeys);
    };
  }, []);

// Lock scroll while the modal is open, same pattern as the header's
  // mobile menu -- without this the page underneath keeps scrolling behind
  // the backdrop, which reads as broken and can jump the scroll position
  // once the modal closes. Locking body alone isn't enough: dragging the
  // browser's native scrollbar thumb moves scrollTop directly and doesn't
  // fire wheel/touch events, so <html> needs the same lock or the
  // scrollbar (and the drag) is still there to grab.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[80]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[81] flex items-end lg:items-center lg:justify-center p-0 lg:p-4">
        <div
          ref={panelRef}
          className="bg-bg-raised w-full lg:w-full lg:max-w-2xl rounded-t-lg lg:rounded-lg border border-border lg:shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-bg-raised border-b border-border px-sp-5 py-sp-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg">{productName}</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                Size chart / measurements
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="px-sp-5 py-sp-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg-raised">
                  <th className="text-left py-2 px-3 font-semibold text-text-primary">
                    Measurement
                  </th>
                  {chart.sizes.map((size) => (
                    <th
                      key={size}
                      className="text-left py-2 px-3 font-semibold text-text-primary"
                    >
                      {size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.specNames.map((name, index) => (
                  <tr
                    key={name}
                    className={index % 2 === 0 ? "bg-bg" : "bg-bg-raised"}
                  >
                    <td className="py-2 px-3 font-semibold text-text-primary">
                      {name}
                    </td>
                    {chart.sizes.map((size) => (
                      <td
                        key={size}
                        className="py-2 px-3 text-text-secondary whitespace-nowrap"
                      >
                        {chart.cells[name]?.[size] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}