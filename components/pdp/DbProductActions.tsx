"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { priceGarmentFromCurve, type GarmentPriceCurve } from "@gwg/pricing";
import { RosterEditor, type RosterRow } from "@/components/shared/RosterEditor";

const QTY_OPTIONS = [24, 48, 96, 250, 500];

export type DbVariantOption = {
  id: string;
  sizeName: string;
  /** Price at the catalog's advertised quantity, used as the fallback. */
  retailMinor: number;
  costMinor?: number;
  mapPriceMinor?: number | null;
  /** Markup row for this garment; lets price follow the quantity picker. */
  priceCurve?: GarmentPriceCurve | null;
  inStock: boolean;
};

/**
 * Blanks get cheaper per piece as the order grows, exactly as they do in a
 * quote. Without the curve (no published v2 config) the catalog price stands.
 */
function unitPriceMinor(
  variant: DbVariantOption | undefined,
  quantity: number,
): number {
  if (!variant) return 0;
  if (!variant.priceCurve || !variant.costMinor) return variant.retailMinor;
  return priceGarmentFromCurve(variant.priceCurve, {
    unitCostMinor: variant.costMinor,
    quantity: Math.max(1, quantity),
    mapPriceMinor: variant.mapPriceMinor ?? null,
  }).sellPerPieceMinor;
}

export function DbProductActions({
  productId,
  styleId,
  name,
  color,
  image,
  variants,
  productSlug,
}: {
  productId: string;
  styleId: string;
  name: string;
  color: string;
  image: string | null;
  variants: DbVariantOption[];
  productSlug?: string;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const [qty, setQty] = useState<number>(48);
  const [isCustomQty, setIsCustomQty] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [groupOrder, setGroupOrder] = useState(false);
  const [roster, setRoster] = useState<RosterRow[]>([
    { size: firstInStock?.sizeName ?? "", name: "", number: "" },
  ]);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === variantId);
  const inStockSizes = variants.filter((v) => v.inStock);

  function selectPresetQty(q: number) {
    setQty(q);
    setIsCustomQty(false);
    setCustomInput("");
    setCustomError(null);
  }

  function handleCustomQtySubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(customInput, 10);
    if (!Number.isFinite(n) || n < 12) {
      setCustomError("Minimum order is 12 pieces.");
      return;
    }
    setCustomError(null);
    setQty(n);
    setIsCustomQty(true);
  }

  if (variants.length === 0) {
    return (
      <p className="text-text-secondary mt-sp-4">
        No sizes currently available for this colour.
      </p>
    );
  }

  return (
    <div className="mt-sp-4">
      <label className="flex items-center gap-2 text-sm font-semibold mb-sp-3 cursor-pointer">
        <input
          type="checkbox"
          checked={groupOrder}
          onChange={(e) => {
            setGroupOrder(e.target.checked);
            setRosterError(null);
          }}
        />
        This is a team/group order — different sizes, names &amp; numbers per piece
      </label>

      {groupOrder ? (
        <div className="mb-sp-4 border border-border rounded-md p-sp-3 bg-bg">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary block mb-2">
            Roster
          </span>
          <RosterEditor
            sizes={inStockSizes.map((v) => ({ id: v.id, label: v.sizeName }))}
            rows={roster}
            onChange={setRoster}
          />
          {rosterError && (
            <p className="text-[12.5px] text-red-600 font-semibold mt-2 mb-0">{rosterError}</p>
          )}
        </div>
      ) : (
        <>
          <span className="text-sm font-bold block mb-2">
            Size:{" "}
            <span className="font-normal">
              {selectedVariant?.sizeName ?? "Select a size"}
            </span>
          </span>
          <div className="flex gap-2 flex-wrap mb-sp-4">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.inStock}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "min-w-11 h-10 px-2.5 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                  !v.inStock &&
                    "opacity-50 cursor-not-allowed border-amber-300 text-amber-800 bg-amber-50",
                  v.inStock &&
                    (v.id === variantId
                      ? "bg-accent text-white border-accent"
                      : "border-border hover:border-text-tertiary")
                )}
              >
                {v.sizeName}
              </button>
            ))}
          </div>
        </>
      )}

      {!groupOrder && selectedVariant && !selectedVariant.inStock && (
        <div className="mb-sp-4 rounded-md border border-amber-300 bg-amber-50 p-sp-3">
          <p className="m-0 text-sm font-bold text-amber-950">
            Color: {color} — Currently Unavailable
          </p>
          <p className="m-0 mt-1 text-sm text-amber-900">
            Size: {selectedVariant.sizeName} — Out of Stock
          </p>
          <p className="m-0 mt-1 text-sm text-amber-900">
            We can often source this size directly, or suggest the closest
            equivalent that is in stock.
          </p>
          <Link
            href="/quote"
            className="mt-3 inline-flex rounded-md border border-amber-800 bg-amber-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-950 transition-colors"
          >
            Ask us to source it
          </Link>
        </div>
      )}

      {!groupOrder && (
        <>
          <span className="text-sm font-bold block mb-2">
            Quantity:{" "}
            <span className="font-normal">
              {qty.toLocaleString()}
              {qty === 500 && !isCustomQty ? "+" : ""} pieces
            </span>
          </span>
          <div className="flex gap-2 flex-wrap mb-sp-2.5">
            {QTY_OPTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => selectPresetQty(q)}
                className={cn(
                  "min-w-[54px] h-10 px-3 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                  !isCustomQty && q === qty
                    ? "bg-accent text-white border-accent"
                    : "border-border bg-bg-raised hover:border-text-tertiary"
                )}
              >
                {q}
                {q === 500 ? "+" : ""}
              </button>
            ))}
          </div>

          {selectedVariant?.priceCurve && (
            <p className="text-[12.5px] text-text-secondary mb-sp-2.5 mt-0">
              {moneyFromMinor(unitPriceMinor(selectedVariant, qty))} per piece
              at {qty.toLocaleString()} — the per-piece price drops as the
              quantity goes up.
            </p>
          )}

          <form onSubmit={handleCustomQtySubmit} className="flex gap-2 mb-sp-4">
            <input
              type="number"
              min={12}
              inputMode="numeric"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (customError) setCustomError(null);
              }}
              placeholder="Or enter exact quantity"
              className="flex-1 min-w-0 border border-border rounded-sm bg-bg-raised px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-sm border border-accent bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors shrink-0"
            >
              Apply
            </button>
          </form>
          {customError && (
            <p className="text-[12.5px] text-red-600 font-semibold -mt-sp-3 mb-sp-4">
              {customError}
            </p>
          )}
        </>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={groupOrder ? roster.length === 0 : !selectedVariant?.inStock}
        onClick={() => {
          if (groupOrder) {
            if (roster.length === 0) {
              setRosterError("Add at least one person.");
              return;
            }
            if (roster.some((r) => !r.name.trim())) {
              setRosterError("Every row needs a name.");
              return;
            }
            const priceVariant =
              variants.find((v) => v.sizeName === roster[0]!.size) ?? firstInStock;
            if (!priceVariant) return;
            setRosterError(null);
            addItem({
              id: productId,
              productId,
              productSlug,
              styleId,
              variantId: priceVariant.id,
              name,
              meta: `Team order · ${roster.length} pieces, mixed sizes`,
              color,
              qty: roster.length,
              unit: unitPriceMinor(priceVariant, roster.length) / 100,
              image: image ?? "",
              roster: roster.map((r) => ({
                size: r.size,
                name: r.name.trim(),
                number: r.number.trim() || undefined,
              })),
            });
            setJustAdded(true);
            setTimeout(() => setJustAdded(false), 2000);
            return;
          }
          if (!selectedVariant) return;
          addItem({
            id: productId,
            productId,
            productSlug,
            styleId,
            variantId: selectedVariant.id,
            name,
            meta: `Size ${selectedVariant.sizeName}`,
            color,
            qty,
            unit: unitPriceMinor(selectedVariant, qty) / 100,
            image: image ?? "",
          });
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 2000);
        }}
      >
        {groupOrder
          ? justAdded
            ? "Added ✓"
            : `Add ${roster.length.toLocaleString()} Piece${roster.length === 1 ? "" : "s"} to Cart`
          : !selectedVariant?.inStock
            ? "Unavailable"
            : justAdded
              ? "Added ✓"
              : `Add ${qty.toLocaleString()} Piece${qty === 1 ? "" : "s"} to Cart · ${moneyFromMinor(
                  unitPriceMinor(selectedVariant, qty) * qty,
                )}`}
      </Button>
    </div>
  );
}

