"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export type QuantityBreak = { qty: number; unitMinor: number };

const POPOVER_WIDTH = 240;
const VIEWPORT_MARGIN = 10;

/**
 * The "i" trigger + quantity-break popup used everywhere on the site a
 * price needs a "here's how it breaks by quantity" detail (catalog cards,
 * the PDP starting-price headline, the Live Estimate Calculator). One
 * component so all three look and behave identically, and so this is fixed
 * in exactly one place: earlier, ad-hoc copies of this popup were
 * positioned as a normal child of their card/panel, which clipped or
 * visually broke wherever the parent had `overflow-hidden` (product
 * cards) or too little room above (top row of a grid). This one portals
 * to the document body and computes its own position from the trigger's
 * real on-screen location, flipping up/down and clamping left/right so it
 * always stays fully on-screen and never gets cut by an ancestor.
 *
 * Opens on hover (a quick, low-commitment preview) and toggles independently
 * on click (a "pin" so it stays open after the pointer moves away, which
 * also makes it usable on touch) — the two states are tracked separately
 * and OR'd together, rather than one combined toggle, which is what caused
 * an earlier version of this popup to open and instantly re-close on click.
 */
export function PricingDetailsPopover({
  quantityBreaks,
  note,
  heading = "Quantity breaks",
  triggerClassName,
  triggerLabel = "Pricing details",
  triggerContent = "i",
}: {
  quantityBreaks: QuantityBreak[];
  /** e.g. "For a standard 1-colour screen print, one location." */
  note?: string;
  /** Popup heading — defaults to "Quantity breaks"; pass e.g. "Quantity
   * breaks (this selection)" where the breaks depend on a live choice. */
  heading?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Defaults to a small "i" circle; pass text (e.g. "Pricing Details") for
   * a text-link-style trigger instead. */
  triggerContent?: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);
  const visible = (hovered || pinned) && quantityBreaks.length > 0;

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const trigger = triggerRef.current;

    function place() {
      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = 76 + quantityBreaks.length * 24 + (note ? 32 : 0);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight + VIEWPORT_MARGIN && rect.top > estimatedHeight;
      let left = rect.left;
      if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
        left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      setPosition({
        top: openUp ? rect.top - 8 : rect.bottom + 8,
        left,
        openUp,
      });
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={visible}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setPinned((v) => !v)}
        className={
          triggerClassName ??
          "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-text-tertiary/60 text-[10px] font-bold text-text-tertiary transition-colors hover:border-accent hover:text-accent shrink-0"
        }
      >
        {triggerContent}
      </button>
      {visible &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-label={triggerLabel}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "fixed",
              left: position.left,
              top: position.openUp ? undefined : position.top,
              bottom: position.openUp ? window.innerHeight - position.top : undefined,
              width: POPOVER_WIDTH,
              zIndex: 100,
            }}
            className="rounded-lg border border-border bg-bg p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
          >
            <p className="m-0 mb-2 pb-2 border-b border-border text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
              {heading}
            </p>
            <ul className="m-0 mb-0 p-0 list-none space-y-1">
              {quantityBreaks.map((b) => (
                <li key={b.qty} className="flex items-center justify-between text-[13px]">
                  <span className="text-text-secondary">{b.qty.toLocaleString()}+ pcs</span>
                  <span className="font-bold text-text-primary">
                    {moneyFromMinor(b.unitMinor)}/ea
                  </span>
                </li>
              ))}
            </ul>
            {note && (
              <p className="m-0 mt-2 pt-2 border-t border-border text-[11px] leading-snug text-text-secondary">
                {note}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
