"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";
import { useBrowsingQuantity } from "@/lib/store/browsing-quantity";

/**
 * "Show prices at [ N ] pieces" — the control that decides what quantity
 * every catalogue card prices itself at.
 *
 * The quantity is shared and persisted, so setting it here also sets it on
 * the full catalogue, the product page and anywhere else a card appears
 * (CodSphere UAT V2 row 17). Extracted from the catalogue grid so the Best
 * Sellers page offers the same control rather than a second implementation
 * that could drift from it.
 */
export function BrowsingQuantityControl({
  className,
}: {
  className?: string;
}) {
  const qty = useBrowsingQuantity((s) => s.qty);
  const setQty = useBrowsingQuantity((s) => s.setQty);
  const inputId = useId();

  return (
    <div
      data-catalog="browse-qty"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border bg-bg-raised py-1 pl-3 pr-1.5",
        className,
      )}
    >
      <label
        htmlFor={inputId}
        className="text-[13px] font-semibold text-text-secondary whitespace-nowrap"
      >
        Show prices at
      </label>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQty(qty - 1)}
          disabled={qty <= 1}
          className="h-8 w-8 grid place-items-center rounded-md font-bold text-text-secondary transition-colors hover:bg-fill-subtle-15 hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
        >
          −
        </button>
        <input
          id={inputId}
          type="number"
          min={1}
          value={qty}
          onChange={(event) => setQty(Number(event.target.value) || 1)}
          className="w-12 h-8 bg-transparent text-center text-sm font-bold text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Quantity to price at"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQty(qty + 1)}
          className="h-8 w-8 grid place-items-center rounded-md font-bold text-text-secondary transition-colors hover:bg-fill-subtle-15 hover:text-accent"
        >
          +
        </button>
      </div>
      <span className="text-[13px] font-semibold text-text-secondary whitespace-nowrap pr-1">
        {qty === 1 ? "piece" : "pieces"}
      </span>
    </div>
  );
}
