"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PricingConfigV2,
  QuoteDecorationLine,
  QuoteInputV2,
} from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { Button } from "@/components/shared/Button";
import { InfoNote } from "@/components/shared/InfoNote";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import {
  LOCATIONS,
  STITCH_PRESET_DISCLAIMER,
  STITCH_PRESETS,
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  filterAllowedLocations,
  methodVariableInputs,
  stitchCountForPreset,
  type StitchPresetId,
} from "@/lib/utils/shop-quote";
import { filterAllowedMethods } from "@/lib/commerce/studio-decoration";
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
 *
 * Layout reworked per CodSphere UAT V2 "Product Page / Live Quote UI Needs
 * to Be Updated" row and its attached "Build Your Estimate" mockup: each
 * decoration is one dropdown-driven row (Method / Location / Detail-Size /
 * Price per unit / Total / remove), quantity sits in a compact control next
 * to the pricing summary, surcharges are informational chips underneath,
 * and the "Estimated from $X" headline is left to PdpStartingPrice above
 * this component so it isn't shown twice on the page.
 */

let rowCounter = 0;
function nextRowId() {
  rowCounter += 1;
  return `pdp-dec-${rowCounter}`;
}

const STITCH_LABELS: Record<StitchPresetId, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  oversized: "Oversized",
};

const selectClassName =
  "w-full border border-border rounded-md bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors";

// Every row now labels its own fields directly (each decoration is its own
// two-row card, not a strip under one shared header), so this shows at
// every width — there is no separate header row left for it to defer to.
const columnLabelClassName =
  "block text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1";

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
  decorationRules,
}: {
  productId: string;
  name: string;
  color: string;
  variants: DbVariantOption[];
  pricingConfig?: PricingConfigV2 | null;
  /** Admin-configured allow-list from this product's categories (CodSphere
   * UAT — "Product-Specific Decoration Methods & Print Locations"). `null`
   * for either means unrestricted. */
  decorationRules?: { methods: string[] | null; locations: string[] | null };
}) {
  const router = useRouter();
  const saveHandoff = usePdpStudioHandoff((s) => s.save);

  // No size selector on this page (CodSphere UAT V2) — the estimate always
  // prices against the first in-stock variant. The full per-size breakdown
  // is chosen later, at the Input Quantity step.
  const firstInStock = variants.find((v) => v.inStock) ?? variants[0];
  const variantId = firstInStock?.id;
  const selectedVariant = firstInStock;

  const methods = useMemo(
    () =>
      filterAllowedMethods(
        pricingConfig ? enabledDecorationMethods(pricingConfig) : [],
        decorationRules?.methods,
      ),
    [pricingConfig, decorationRules],
  );
  const locations = useMemo(
    () => filterAllowedLocations(LOCATIONS, decorationRules?.locations),
    [decorationRules],
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
    blankRow(
      locations.find((l) => l.id === pricingConfig?.storefront?.defaultLocation)
        ?.id ??
        locations[0]?.id ??
        "front",
    ),
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
      locations.find((loc) => !usedLocations.has(loc.id))?.id ??
      locations[0]?.id ??
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

  /** Quantity-break table (also drives the tick labels under the slider),
   * driven by the enabled methods' own qtyAnchors — same anchors the
   * engine already uses, just re-run at each one with the current
   * decoration selections. */
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

  // Publish this selection's live pricing so the "Estimated from" headline
  // near the product title (PdpStartingPrice) tracks it too, instead of
  // showing its own separately-guessed default. That headline is the only
  // place "Estimated from $X" appears now — it used to be duplicated here
  // as well, which read as two different prices on the same page.
  const publishLiveEstimate = usePdpLiveEstimate((s) => s.publish);
  const liveUnitMinor = breakdown
    ? Math.round(breakdown.totals.totalMinor / Math.max(1, qty))
    : null;
  useEffect(() => {
    publishLiveEstimate(
      productId,
      quantityBreaks,
      liveUnitMinor == null ? null : { qty, unitMinor: liveUnitMinor },
    );
  }, [productId, quantityBreaks, qty, liveUnitMinor, publishLiveEstimate]);

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

  // Tick labels under the quantity slider — the engine's real quantity
  // anchors for the current decoration selections, not fixed round numbers,
  // capped so the row stays readable.
  const tickBreaks = quantityBreaks.filter((b) => b.qty <= 500).slice(0, 6);
  const hasHigherAnchor = quantityBreaks.some((b) => b.qty > 500);

  return (
    <div
      id="live-estimate-calculator"
      className="mt-sp-6 border border-border rounded-lg bg-bg-raised p-sp-5"
    >
      <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-1">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        Build Your Estimate
      </div>
      <p className="text-sm text-text-secondary mb-sp-4">
        Adjust decoration methods, locations and details to see live estimated pricing.
      </p>

      {/* No size selector here (CodSphere UAT V2 — "Size selection in
          product page ... not required on this page, please remove"). The
          estimate still needs a garment cost to price against, so it's
          pinned to the first in-stock variant behind the scenes — sizes and
          the full per-size breakdown are chosen at the Input Quantity step
          after the Design Studio, same as before. Existing pricing logic is
          unchanged; this is presentation only. */}

      {/* Decoration rows — one horizontal, dropdown-driven row each,
          matching the "Build Your Estimate" mockup instead of the previous
          stack of pill-button sections. */}
      {/* Two rows per decoration, not one crammed six-across strip: Method
          and Location carry the longest real labels ("Screen Print", "Left
          chest") and were previously squeezed into ~1fr of a six-column
          grid — plenty of room in isolation, not enough once the sidebar
          itself is narrow, and native <select> text clips hard with no
          ellipsis when it runs out of width. Giving them a row to
          themselves removes the clipping regardless of viewport width,
          rather than chasing a wider-but-still-eventually-too-narrow
          column. */}
      <div className="space-y-sp-3 mb-sp-2">
        {rows.map((row) => {
          const method = methods.find((m) => m.key === row.methodKey);
          const fields = methodVariableInputs(method);
          const pricing = rowPricing(row.id);
          return (
            <div
              key={row.id}
              className="border border-border rounded-md p-sp-3 space-y-sp-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-2">
                <div>
                  <span className={columnLabelClassName}>Decoration Method</span>
                  <select
                    value={row.methodKey}
                    onChange={(e) => {
                      const nextMethod = methods.find((m) => m.key === e.target.value);
                      updateRow(row.id, {
                        methodKey: e.target.value,
                        optionKey: defaultOptionKey(nextMethod),
                      });
                    }}
                    className={selectClassName}
                  >
                    {methods.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className={columnLabelClassName}>Print Location</span>
                  <select
                    value={row.location}
                    onChange={(e) => updateRow(row.id, { location: e.target.value })}
                    className={selectClassName}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_24px] gap-sp-2 items-end">
                <div>
                  <span className="relative flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1">
                    Detail / Size
                    <button
                      type="button"
                      aria-label="Size Guide"
                      aria-expanded={openInfo === "size-guide"}
                      onClick={() =>
                        setOpenInfo((current) => (current === "size-guide" ? null : "size-guide"))
                      }
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold normal-case"
                    >
                      i
                    </button>
                    {openInfo === "size-guide" && (
                      <div
                        role="dialog"
                        aria-label="Decoration size guide"
                        className="absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-border bg-bg p-sp-3 shadow-lg normal-case"
                      >
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide">Size Guide</p>
                        <ul className="space-y-1 text-sm">
                          <li>Small: up to 4&quot;</li>
                          <li>Medium: over 4&quot; to 8&quot;</li>
                          <li>Large: over 8&quot; to 12&quot;</li>
                          <li>Oversized: over 12&quot;</li>
                        </ul>
                        <p className="mt-2 text-xs text-text-secondary">
                          Use the size that best matches your artwork/logo. Final suitability is
                          confirmed after artwork review.
                        </p>
                      </div>
                    )}
                  </span>
                  {fields.colours && (
                    <select
                      value={row.colours ?? colourOptions(method)[0] ?? 1}
                      onChange={(e) => updateRow(row.id, { colours: Number(e.target.value) })}
                      className={selectClassName}
                    >
                      {colourOptions(method).map((c) => (
                        <option key={c} value={c}>
                          {c} {c === 1 ? "Colour" : "Colours"}
                        </option>
                      ))}
                    </select>
                  )}
                  {fields.stitches && (
                    <>
                      <select
                        value={row.stitchPreset ?? "medium"}
                        onChange={(e) =>
                          updateRow(row.id, { stitchPreset: e.target.value as StitchPresetId })
                        }
                        className={selectClassName}
                      >
                        {STITCH_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {STITCH_LABELS[preset.id]}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] leading-snug text-text-tertiary">
                        {STITCH_PRESET_DISCLAIMER}
                      </p>
                    </>
                  )}
                  {fields.option && method?.rateModel.kind === "matrixByOption" && (
                    <select
                      value={row.optionKey || defaultOptionKey(method)}
                      onChange={(e) => updateRow(row.id, { optionKey: e.target.value })}
                      className={selectClassName}
                    >
                      {method.rateModel.options.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!fields.colours && !fields.stitches && !fields.option && (
                    <p className="m-0 py-2 text-sm text-text-tertiary">—</p>
                  )}
                </div>

                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1">
                    Price/unit
                  </span>
                  <p className="m-0 py-2 text-sm font-semibold truncate">
                    {pricing ? moneyFromMinor(pricing.unitMinor) : "—"}
                  </p>
                </div>

                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1">
                    Total
                  </span>
                  <p className="m-0 py-2 text-sm font-bold truncate">
                    {pricing ? moneyFromMinor(pricing.totalMinor) : "—"}
                  </p>
                </div>

                <div className="flex justify-center pb-2">
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Remove decoration"
                      onClick={() => removeRow(row.id)}
                      className="text-text-tertiary hover:text-red-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="text-text-tertiary/30 text-lg leading-none">×</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="text-sm font-bold text-accent mb-sp-4"
        onClick={addRow}
      >
        + Add another decoration
      </button>

      {/* Quantity (left) and live pricing summary (right) side by side on
          desktop, matching the mockup — stacked on mobile. */}
      <div className="grid gap-sp-4 md:grid-cols-[1.4fr_1fr] mb-sp-4 pt-sp-4 border-t border-border">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-text-tertiary mb-sp-2">
            Quantity
          </p>
          <input
            type="range"
            min={1}
            max={500}
            value={Math.min(qty, 500)}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full accent-accent"
          />
          {tickBreaks.length > 0 && (
            <div className="flex justify-between mt-1 text-[10px] text-text-tertiary">
              {tickBreaks.map((b) => (
                <span key={b.qty}>{b.qty}</span>
              ))}
              {hasHigherAnchor && <span>500+</span>}
            </div>
          )}
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

        <div className="rounded-md bg-fill-subtle-15 p-sp-3">
          {result?.error && (
            <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 text-sm">
              {result.error}
            </p>
          )}
          {breakdown ? (
            <>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold">Total per unit</span>
                <span className="text-lg font-bold text-accent">
                  {moneyFromMinor(
                    Math.round(breakdown.totals.totalMinor / Math.max(1, qty)),
                  )}
                </span>
              </div>
              <div className="flex justify-between items-baseline mt-1.5">
                <span className="text-sm font-bold">Estimated Total</span>
                <span className="text-xl font-display font-bold text-accent">
                  {moneyFromMinor(breakdown.totals.totalMinor)}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary mt-1">
                for {qty.toLocaleString()} {qty === 1 ? "piece" : "pieces"} · before tax &amp; shipping
              </p>
            </>
          ) : (
            !result?.error && (
              <p className="text-sm text-text-secondary italic">
                Pick a size above to see decorated pricing.
              </p>
            )
          )}
        </div>
      </div>

      {/* Surcharges — informational only, not selectable on this page (see
          the Design Studio / Input Quantity step for that). Split into
          Names and Numbers to match the mockup; both currently read from
          the same published namesNumbersFeePerGarmentMinor since there is
          one combined fee in the pricing config, not two. */}
      <div className="flex flex-wrap gap-x-sp-5 gap-y-2 text-xs text-text-secondary border-t border-border pt-sp-3 mb-sp-4">
        <span className="w-full text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
          Surcharges may apply for additional options
        </span>
        {namesNumbersFeeMinor > 0 && (
          <InfoNote
            id="names"
            open={openInfo === "names"}
            onToggle={() => setOpenInfo((v) => (v === "names" ? null : "names"))}
            label={`Individual Names — +${moneyFromMinor(namesNumbersFeeMinor)} each`}
            detail="Add names per person in the next step. Not included in the estimate above."
          />
        )}
        {namesNumbersFeeMinor > 0 && (
          <InfoNote
            id="numbers"
            open={openInfo === "numbers"}
            onToggle={() => setOpenInfo((v) => (v === "numbers" ? null : "numbers"))}
            label={`Individual Numbers — +${moneyFromMinor(namesNumbersFeeMinor)} each`}
            detail="Add numbers per person in the next step. Not included in the estimate above."
          />
        )}
        <InfoNote
          id="2xl"
          open={openInfo === "2xl"}
          onToggle={() => setOpenInfo((v) => (v === "2xl" ? null : "2xl"))}
          label="2XL+ — additional surcharge"
          detail="Varies by garment/style and is confirmed with your size breakdown after the Design Studio."
        />
      </div>

      <p className="text-[11px] text-text-secondary italic border border-border rounded-md bg-fill-subtle-15 px-sp-3 py-sp-2 mb-sp-3">
        This is a live estimate only. Final colours, quantities, sizes and artwork
        details are selected in the Design Studio.
      </p>

      <Button className="w-full" onClick={handleStartDesigning}>
        {handedOff ? "Opening Design Studio…" : "Continue to Design & Finalize Quote →"}
      </Button>
      <p className="text-[11px] text-text-secondary italic mt-sp-2 text-center">
        Secure &amp; easy process · No payment required
      </p>
    </div>
  );
}