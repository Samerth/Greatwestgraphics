"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PricingConfigV2 } from "@gwg/contracts";
import {
  cheapestCatalogMatch,
  type CheapestMatchCandidate,
} from "@/lib/commerce/cheapest-match";
import {
  colourOptions,
  defaultOptionKey,
  enabledDecorationMethods,
  methodVariableInputs,
} from "@/lib/utils/shop-quote";
import { QB_QTY_OPTIONS, moneyFromMinor } from "@/lib/utils/quote-pricing";
import { Pill, QbRow } from "@/components/quote-builder/QuoteFormControls";

export type GarmentTypeOption = { slug: string; name: string };

/**
 * "Small template to fill in for quote. Preset buttons OR type · Give
 * results based on cheapest price product · Link to product page" —
 * Pavin's note, and the plan's own read of it: a short, requirements-first
 * form (garment type, quantity, decoration) that recommends the cheapest
 * real, in-stock product for those answers, rather than asking the shopper
 * to already know which product they want.
 *
 * This sits beside the existing product-first QuoteBuilder rather than
 * replacing it — someone who already knows their garment still wants that
 * one. This is for "I don't know yet, just find me the cheapest option."
 */
export function CheapestMatchFinder({
  pricingConfig,
  garmentTypes,
  candidates,
}: {
  pricingConfig: PricingConfigV2;
  /** Top-level categories only — "T-Shirts", "Hoodies", "Headwear" — not
   *  every subcategory, so this stays a handful of buttons, not a wall. */
  garmentTypes: GarmentTypeOption[];
  candidates: CheapestMatchCandidate[];
}) {
  const methods = useMemo(() => enabledDecorationMethods(pricingConfig), [pricingConfig]);

  const [categorySlug, setCategorySlug] = useState<string>(garmentTypes[0]?.slug ?? "");
  const [qty, setQty] = useState<number>(48);
  const [customQty, setCustomQty] = useState("");
  const [methodKey, setMethodKey] = useState<string>(methods[0]?.key ?? "");
  const [colours, setColours] = useState<number>(1);

  const selectedMethod = methods.find((m) => m.key === methodKey) ?? methods[0];
  const fields = methodVariableInputs(selectedMethod);

  function selectQty(next: number) {
    setQty(next);
    setCustomQty("");
  }

  function onCustomQtyChange(raw: string) {
    setCustomQty(raw);
    const parsed = Math.round(Number(raw));
    if (Number.isFinite(parsed) && parsed > 0) setQty(parsed);
  }

  // `colours` can be left over from a method that offered a different range
  // (e.g. switching away from and back to a colour-priced method) — clamp
  // to a value the *current* method actually offers rather than pricing a
  // colour count it doesn't have a rate for.
  const validColours = useMemo(() => colourOptions(selectedMethod), [selectedMethod]);
  const effectiveColours = useMemo(
    () => (validColours.includes(colours) ? colours : (validColours[0] ?? colours)),
    [validColours, colours],
  );

  const result = useMemo(() => {
    if (!categorySlug || !selectedMethod || qty <= 0) return null;
    return cheapestCatalogMatch(pricingConfig, candidates, {
      categorySlug,
      quantity: qty,
      methodKey: selectedMethod.key,
      colours: fields.colours ? effectiveColours : undefined,
      optionKey: fields.option ? defaultOptionKey(selectedMethod) : undefined,
    });
  }, [pricingConfig, candidates, categorySlug, qty, selectedMethod, fields, effectiveColours]);

  if (garmentTypes.length === 0 || methods.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-bg-raised p-sp-4">
      <h2 className="font-display font-bold text-xl m-0">
        Not sure which product to start with?
      </h2>
      <p className="text-text-secondary text-sm mt-1 mb-sp-4">
        Answer a few quick questions and we&apos;ll find the cheapest garment
        that fits — no need to already know which one you want.
      </p>

      <QbRow label="Garment type">
        {garmentTypes.map((type) => (
          <Pill
            key={type.slug}
            active={categorySlug === type.slug}
            onClick={() => setCategorySlug(type.slug)}
          >
            {type.name}
          </Pill>
        ))}
      </QbRow>

      <QbRow label="Quantity">
        {QB_QTY_OPTIONS.map((option) => (
          <Pill key={option} active={!customQty && qty === option} onClick={() => selectQty(option)}>
            {option}
          </Pill>
        ))}
        <input
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="Other"
          value={customQty}
          onChange={(e) => onCustomQtyChange(e.target.value)}
          className="w-24 rounded-md border border-border bg-bg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
      </QbRow>

      <QbRow label="Decoration">
        {methods.map((method) => (
          <Pill
            key={method.key}
            active={methodKey === method.key}
            onClick={() => setMethodKey(method.key)}
          >
            {method.label}
          </Pill>
        ))}
      </QbRow>

      {fields.colours && (
        <QbRow label="How many colours in your design?">
          {validColours.map((c) => (
            <Pill key={c} active={effectiveColours === c} onClick={() => setColours(c)}>
              {c} {c === 1 ? "Colour" : "Colours"}
            </Pill>
          ))}
        </QbRow>
      )}

      <div className="mt-sp-4 pt-sp-4 border-t border-border">
        {result ? (
          <div
            data-quote="cheapest-match-result"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.1em] text-accent">
                Cheapest match
              </p>
              <p className="m-0 mt-1 font-display font-bold text-lg">
                {result.product.label}
              </p>
              <p className="m-0 text-sm text-text-secondary">
                {moneyFromMinor(result.perPieceMinor)} / piece at {qty}{" "}
                {qty === 1 ? "piece" : "pieces"}, decorated — estimate, tax
                excluded.
              </p>
            </div>
            <Link
              href={`/product/${encodeURIComponent(result.product.slug)}?id=${result.product.id}`}
              className="shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              View this product
            </Link>
          </div>
        ) : (
          <p className="m-0 text-sm text-text-tertiary">
            No in-stock {garmentTypes.find((t) => t.slug === categorySlug)?.name.toLowerCase()}{" "}
            currently matches — try a different garment type.
          </p>
        )}
      </div>
    </div>
  );
}
