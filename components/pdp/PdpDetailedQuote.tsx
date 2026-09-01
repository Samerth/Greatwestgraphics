"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PricingConfigV2,
  QuoteDecorationLine,
  QuoteInputV2,
} from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { Pill, QbRow } from "@/components/quote-builder/QuoteFormControls";
import { Button } from "@/components/shared/Button";
import { InfoNote } from "@/components/shared/InfoNote";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import {
  LOCATIONS,
  STITCH_PRESETS,
  STITCH_PRESET_DISCLAIMER,
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
  stitchCountForPreset,
  type StitchPresetId,
} from "@/lib/utils/shop-quote";
import { usePdpStudioHandoff } from "@/lib/store/pdp-studio-handoff";
import { usePdpLiveEstimate } from "@/lib/store/pdp-live-estimate";
import { useBrowsingQuantity } from "@/lib/store/browsing-quantity";
import type { DbVariantOption } from "@/components/pdp/DbProductActions";

/**
 * The PDP "Detailed Quote" / Live Estimate Calculator (CodSphere UAT V2,
 * row 8). Coastal Reign is the functional benchmark only (add decoration →
 * edit quantity → live price, before Design Studio) — this does not copy
 * CR's visual design. Built directly on calculateQuoteV2 (the same engine
 * admin's CalculatorTab drives) instead of the single-decoration
 * priceShopperQuote wrapper, because the doc requires multiple independent
 * decoration rows, and priceShopperQuote can only price one decoration at
 * a time. No new pricing logic — same engine, called with a richer input.
 */

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `pdp-dec-${rowCounter}`;
}

type DecorationRow = {
  id: string;
  methodKey: string;
  location: string;
  colours?: number;
  stitchPreset?: StitchPresetId;
  optionKey?: string;
};

export function PdpDetailedQuote({
  productId,
  name,
  color,
  variants,
  pricingConfig,
}: {
  productId: string;
  name: string;
  color: string;
  variants: DbVariantOption[];
  pricingConfig?: PricingConfigV2 | null;
}) {
  const router = useRouter();
  const saveHandoff = usePdpStudioHandoff((s) => s.save);

  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];
  const [variantId, setVariantId] = useState(firstInStock?.id);
  const selectedVariant = variants.find((v) => v.id === variantId);

  const methods = useMemo(
    () => (pricingConfig ? enabledDecorationMethods(pricingConfig) : []),
    [pricingConfig],
  );
  const defaultMethodKey =
    methods.find((m) => m.key === pricingConfig?.storefront?.defaultMethodKey)
      ?.key ??
    methods[0]?.key ??
    "";

  function blankRow(location: string): DecorationRow {
    const method = methods.find((m) => m.key === defaultMethodKey);
    return {
      id: nextRowId(),
      methodKey: defaultMethodKey,
      location,
      colours: pricingConfig?.storefront?.defaultColours ?? 1,
      stitchPreset: "medium",
      optionKey: defaultOptionKey(method),
    };
  }

  const [rows, setRows] = useState<DecorationRow[]>(() => [
    blankRow(pricingConfig?.storefront?.defaultLocation ?? "front"),
  ]);

  // Seeded from the shared browsing quantity (the last quantity used on
  // *any* product's calculator), not a fixed default, so this genuinely
  // picks up where the customer left off rather than resetting per product.
  const setBrowsingQty = useBrowsingQuantity((s) => s.setQty);
  const [qty, setQty] = useState(() => useBrowsingQuantity.getState().qty);
  const [handedOff, setHandedOff] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  const namesNumbersFeeMinor =
    pricingConfig?.settings?.namesNumbersFeePerGarmentMinor ?? 0;

  function updateRow(id: string, patch: Partial<DecorationRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const usedLocations = new Set(rows.map((r) => r.location));
    const nextLocation =
      LOCATIONS.find((loc) => !usedLocations.has(loc.id))?.id ??
      LOCATIONS[0]?.id ??
      "back";
    setRows((prev) => [...prev, blankRow(nextLocation)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function setQuantity(next: number) {
    const clamped = Math.max(1, Math.round(next));
    setQty(clamped);
    setBrowsingQty(clamped);
  }

  function decorationLinesFor(quantity: number): QuoteDecorationLine[] {
    return rows.map((row) => {
      const method = methods.find((m) => m.key === row.methodKey);
      const fields = methodVariableInputs(method);
      return {
        id: row.id,
        garmentId: "g1",
        methodKey: row.methodKey,
        location: row.location,
        logoGroup: "",
        colours: fields.colours
          ? row.colours ?? colourOptions(method)[0] ?? 1
          : undefined,
        variableValue: fields.stitches
          ? stitchCountForPreset(row.stitchPreset ?? "medium")
          : undefined,
        optionKey: fields.option
          ? row.optionKey ?? defaultOptionKey(method)
          : undefined,
        isOversized:
         fields.stitches && row.stitchPreset === "oversized",

        artwork: { isRepeat: false, verifiedByStaff: false },
      };
    });
  }

  function quoteInputAt(quantity: number): QuoteInputV2 | null {
    if (!selectedVariant?.costMinor) return null;
    return {
      garments: [
        {
          id: "g1",
          description: name,
          unitCostMinor: selectedVariant.costMinor,
          quantity,
          colourName: color,
          mapPriceMinor: selectedVariant.mapPriceMinor ?? undefined,
        },
      ],
      decorations: decorationLinesFor(quantity),
      options: {
        rush: false,
        includePacking: true,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };
  }

  const result = useMemo(() => {
    if (!pricingConfig) return null;
    const input = quoteInputAt(qty);
    if (!input) return null;
    try {
      return { breakdown: calculateQuoteV2(input, pricingConfig), error: null };
    } catch (error) {
      return {
        breakdown: null,
        error: error instanceof Error ? error.message : "Could not price this quote",
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingConfig, selectedVariant, rows, qty, name, color]);

  const breakdown = result?.breakdown ?? null;

  /** Per-row price, read straight off the lines the engine already tagged
   * with this row's decorationId — no separate calc. */
  function rowPricing(rowId: string) {
    if (!breakdown) return null;
    const rowLines = breakdown.lines.filter((line) => line.decorationId === rowId);
    const totalMinor = rowLines.reduce((sum, l) => sum + l.extendedAmountMinor, 0);
    return { totalMinor, unitMinor: totalMinor / Math.max(1, qty) };
  }

  /** Quantity-break table for the Pricing Details popup, driven by the
   * enabled methods' own qtyAnchors — same anchors the engine already uses,
   * just re-run at each one with the current decoration selections. */
  const quantityBreaks = useMemo(() => {
    if (!pricingConfig) return [];
    const anchors = new Set<number>();
    for (const row of rows) {
      const method = methods.find((m) => m.key === row.methodKey);
      method?.rateModel.qtyAnchors.forEach((a) => anchors.add(a));
    }
    return [...anchors]
      .sort((a, b) => a - b)
      .map((anchorQty) => {
        const input = quoteInputAt(anchorQty);
        if (!input) return null;
        try {
          const b = calculateQuoteV2(input, pricingConfig);
          return { qty: anchorQty, unitMinor: b.totals.totalMinor / anchorQty };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { qty: number; unitMinor: number } => entry !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingConfig, selectedVariant, rows]);

  const startingFromMinor = quantityBreaks[0]?.unitMinor ?? null;

  // Publish this selection's live pricing so the "Estimated from" headline
  // near the product title (PdpStartingPrice) tracks it too, instead of
  // showing its own separately-guessed default.
  const publishLiveEstimate = usePdpLiveEstimate((s) => s.publish);
  useEffect(() => {
    publishLiveEstimate(productId, quantityBreaks);
  }, [productId, quantityBreaks, publishLiveEstimate]);

  function handleStartDesigning() {
    const primary = rows[0];
    saveHandoff({
      productId,
      variantId,
      sizeName: selectedVariant?.sizeName,
      qty,
      methodKey: primary?.methodKey,
      location: primary?.location,
      colours: primary?.colours,
      stitchPreset: primary?.stitchPreset,
      optionKey: primary?.optionKey,
      decorations: rows.map((r) => ({
        methodKey: r.methodKey,
        location: r.location,
        colours: r.colours,
        stitchPreset: r.stitchPreset,
        optionKey: r.optionKey,
      })),
    });
    setHandedOff(true);
    router.push(`/design?garmentId=${productId}`);
  }

  if (methods.length === 0 || variants.length === 0) return null;

  return (
    <div
      id="live-estimate-calculator"
      className="mt-sp-6 border border-border rounded-lg bg-bg-raised p-sp-5"
    >
      <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        Live Estimate
      </div>

      {startingFromMinor != null && (
        <div className="flex items-center gap-2 mb-sp-1">
          <p className="text-sm font-semibold m-0">
            Estimated from {moneyFromMinor(startingFromMinor)} CAD each at{" "}
            {quantityBreaks[0]?.qty} pieces
          </p>
          <PricingDetailsPopover
            quantityBreaks={quantityBreaks}
            heading="Quantity breaks (this selection)"
            triggerContent="Pricing Details"
            triggerClassName="text-xs font-bold text-accent underline underline-offset-2"
          />
        </div>
      )}

      <p className="text-sm text-text-secondary mb-sp-4">
        Build your estimate for {name}. Final pricing is confirmed after artwork,
        colours, sizes and quantities are selected.
      </p>

      {/* Size — available so the estimate reflects the right garment cost,
          not a required breakdown (that happens at Input Quantity). This is
          the garment size (S/M/L/XL) — the decoration size guide lives with
          the "Logo size" picker below, where it actually applies. */}
      {variants.length > 1 && (
        <div className="mb-sp-4">
          <span className="block mb-sp-2 text-xs font-bold tracking-[0.14em] uppercase text-text-tertiary">
            Size
          </span>
          <QbRow label="">
            {variants.map((v) => (
              <Pill
                key={v.id}
                active={v.id === variantId}
                onClick={() => setVariantId(v.id)}
              >
                {v.sizeName}
                {!v.inStock ? " (out of stock)" : ""}
              </Pill>
            ))}
          </QbRow>
        </div>
      )}

      {/* Build Your Estimate */}
      <p className="text-xs font-bold tracking-[0.14em] uppercase text-text-tertiary mb-sp-2">
        Build Your Estimate
      </p>
      <div className="space-y-sp-4 mb-sp-2">
        {rows.map((row, index) => {
          const method = methods.find((m) => m.key === row.methodKey);
          const fields = methodVariableInputs(method);
          const pricing = rowPricing(row.id);
          return (
            <div
              key={row.id}
              className="border border-border rounded-md p-sp-3 space-y-sp-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  Decoration {index + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-accent"
                    onClick={() => removeRow(row.id)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <QbRow label="Method">
                {methods.map((m) => (
                  <Pill
                    key={m.key}
                    active={m.key === row.methodKey}
                    onClick={() =>
                      updateRow(row.id, {
                        methodKey: m.key,
                        optionKey: defaultOptionKey(m),
                      })
                    }
                  >
                    {m.label}
                  </Pill>
                ))}
              </QbRow>

              <QbRow label="Location">
                {LOCATIONS.map((loc) => (
                  <Pill
                    key={loc.id}
                    active={loc.id === row.location}
                    onClick={() => updateRow(row.id, { location: loc.id })}
                  >
                    {loc.label}
                  </Pill>
                ))}
              </QbRow>

              {fields.colours && (
                <QbRow label="Number of colours">
                  {colourOptions(method).map((c) => (
                    <Pill
                      key={c}
                      round
                      active={c === row.colours}
                      onClick={() => updateRow(row.id, { colours: c })}
                    >
                      {c}
                    </Pill>
                  ))}
                </QbRow>
              )}

              {fields.stitches && (
                <div className="mb-sp-4">
                  <div className="relative flex items-center gap-2 mb-sp-2">
                    <span className="text-xs font-bold tracking-[0.1em] uppercase text-text-tertiary">
                      Logo size
                    </span>
                    <button
                      type="button"
                      aria-label="Size Guide"
                      aria-expanded={openInfo === `size-guide-${row.id}`}
                      // Click-only toggle — a combined hover-open + click-toggle
                      // fought itself here (see PdpStartingPrice for the same
                      // fix): moving the pointer onto the button opened the
                      // popup via hover, so the click immediately closed it
                      // again for a real mouse user.
                      onClick={() =>
                        setOpenInfo((current) =>
                          current === `size-guide-${row.id}`
                            ? null
                            : `size-guide-${row.id}`,
                        )
                      }
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold"
                    >
                      i
                    </button>
                    {openInfo === `size-guide-${row.id}` && (
                      <div
                        role="dialog"
                        aria-label="Decoration size guide"
                        className="absolute left-0 top-full z-20 mt-2 w-80 rounded-md border border-border bg-bg p-sp-3 shadow-lg"
                      >
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide">
                          Size Guide
                        </p>
                        <ul className="space-y-1 text-sm">
                          <li>Small: up to 4&quot;</li>
                          <li>Medium: over 4&quot; to 8&quot;</li>
                          <li>Large: over 8&quot; to 12&quot;</li>
                          <li>Oversized: over 12&quot;</li>
                        </ul>
                        <p className="mt-2 text-xs text-text-secondary">
                          Final suitability is confirmed after artwork review.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STITCH_PRESETS.map((preset) => (
                      <Pill
                        key={preset.id}
                        active={preset.id === row.stitchPreset}
                        onClick={() => updateRow(row.id, { stitchPreset: preset.id })}
                      >
                        <span>{preset.label}</span>
                      </Pill>
                    ))}
                  </div>
                  <p className="mt-sp-2 text-[11px] text-text-secondary italic">
                    {STITCH_PRESET_DISCLAIMER}
                  </p>
                </div>
              )}

              {fields.option && method?.rateModel.kind === "matrixByOption" && (
                <QbRow label="Size">
                  {method.rateModel.options.map((opt) => (
                    <Pill
                      key={opt.key}
                      active={opt.key === row.optionKey}
                      onClick={() => updateRow(row.id, { optionKey: opt.key })}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </QbRow>
              )}

              {pricing && (
                <div className="flex justify-between items-baseline pt-sp-2 border-t border-border text-sm">
                  <span className="text-text-secondary">
                    Price per unit: {moneyFromMinor(pricing.unitMinor)}
                  </span>
                  <span className="font-bold">
                    Total: {moneyFromMinor(pricing.totalMinor)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="text-sm font-bold text-accent mb-sp-5"
        onClick={addRow}
      >
        + Add another decoration
      </button>

      {/* Quantity */}
      <p className="text-xs font-bold tracking-[0.14em] uppercase text-text-tertiary mb-sp-2">
        Quantity
      </p>
      <div className="mb-sp-3">
        <input
          type="range"
          min={1}
          max={500}
          value={Math.min(qty, 500)}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex items-center gap-sp-3 mt-sp-2">
            <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity(qty - 1)}
                disabled={qty <= 1}
                className="h-10 w-10 text-lg font-bold disabled:opacity-40"
                >
                −
                </button>

                <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="w-20 h-10 border-x border-border px-2 text-center text-sm font-bold"
                aria-label="Quantity"
                />

                <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity(qty + 1)}
                className="h-10 w-10 text-lg font-bold"
                >
                +
                </button>
            </div>

            <span className="text-sm text-text-secondary">pieces</span>
            </div>

      </div>

      {/* Names/numbers & 2XL+ — informational only, not selectable here */}
      <div className="text-xs text-text-secondary space-y-1 mb-sp-4">
        {namesNumbersFeeMinor > 0 && (
          <InfoNote
            id="names-numbers"
            open={openInfo === "names-numbers"}
            onToggle={() =>
              setOpenInfo((v) => (v === "names-numbers" ? null : "names-numbers"))
            }
            label={`Individual names/numbers available (+${moneyFromMinor(namesNumbersFeeMinor)}/piece)`}
            detail="Select this in the next step. Price shown here does not include it."
          />
        )}
        <InfoNote
          id="2xl"
          open={openInfo === "2xl"}
          onToggle={() => setOpenInfo((v) => (v === "2xl" ? null : "2xl"))}
          label="2XL+ sizes carry an additional surcharge"
          detail="The exact amount varies by garment/style and is confirmed with your size breakdown."
        />
      </div>

      {/* Live pricing */}
      {result?.error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 text-sm mb-sp-3">
          {result.error}
        </p>
      )}
      {breakdown ? (
        <div className="border-t border-border pt-sp-4 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-bold">Total per unit</span>
            <span className="text-lg font-bold text-accent">
              {moneyFromMinor(
                Math.round(breakdown.totals.totalMinor / Math.max(1, qty)),
              )}
            </span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-bold">Estimated order total</span>
            <span className="text-2xl font-display font-bold text-accent">
              {moneyFromMinor(breakdown.totals.totalMinor)}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary">Before tax &amp; shipping.</p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary italic">
          Pick a size above to see decorated pricing.
        </p>
      )}

      <p className="text-[11px] text-text-secondary italic mt-sp-3">
        Live estimate only. Final pricing is confirmed after artwork, colours,
        sizes and quantities are selected.
      </p>

      <Button className="w-full mt-sp-3" onClick={handleStartDesigning}>
        {handedOff ? "Opening Design Studio…" : "Continue to Design Studio →"}
      </Button>
      <p className="text-[11px] text-text-secondary italic mt-sp-2 text-center">
        Finalize artwork and quote in the next steps.
      </p>
    </div>
  );
}