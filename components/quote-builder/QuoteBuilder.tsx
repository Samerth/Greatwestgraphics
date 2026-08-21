"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DecorationMethodConfig,
  PricingConfigV2,
  QuoteInputV2,
} from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { OptionalImage } from "@/components/shared/OptionalImage";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { useCartStore } from "@/lib/store/cart";
import {
  QB_METHOD_DAYS,
  QB_PRODUCT_COST_MINOR,
  QB_PRODUCT_IS_DARK,
  QB_PRODUCTS,
  QB_QTY_OPTIONS,
  moneyFromMinor,
  type QbProduct,
} from "@/lib/utils/quote-pricing";

const LOCATIONS = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "leftChest", label: "Left chest" },
  { id: "sleeve", label: "Sleeve" },
] as const;

const STITCH_PRESETS = [
  { id: "small", stitches: 5000, label: "Small logo" },
  { id: "medium", stitches: 8000, label: "Medium logo" },
  { id: "large", stitches: 12000, label: "Large logo" },
] as const;

/** Colour counts the picker offers, capped so the row stays readable. */
const MAX_COLOUR_PILLS = 6;

const METHOD_BLURBS: Record<string, string> = {
  screenPrint: "Best value for bulk",
  embroidery: "Stitched, premium look",
  dtf: "Full-colour photos & gradients",
};

/** Which extra question to ask, decided by the method's rate model. */
function variableInputFor(method: DecorationMethodConfig | undefined) {
  return {
    colours: method?.rateModel.kind === "matrixByColour",
    stitches: method?.rateModel.kind === "baseWithVariable",
    option: method?.rateModel.kind === "matrixByOption",
  };
}

function defaultOptionKey(method: DecorationMethodConfig | undefined): string {
  if (method?.rateModel.kind !== "matrixByOption") return "";
  const options = method.rateModel.options;
  return (options[Math.min(1, options.length - 1)] ?? options[0])?.key ?? "";
}

function colourOptions(method: DecorationMethodConfig | undefined): number[] {
  if (method?.rateModel.kind !== "matrixByColour") return [];
  const { minColours, maxColours } = method.rateModel;
  const options: number[] = [];
  for (
    let count = minColours;
    count <= Math.min(maxColours, minColours + MAX_COLOUR_PILLS - 1);
    count += 1
  ) {
    options.push(count);
  }
  return options;
}

type CatalogOption = {
  id: string;
  label: string;
  /** Optional — when present, options are grouped by style so "Pick your
   * product" shows one entry per garment, not one per colourway. */
  brandName?: string;
  styleName?: string;
  /** Manufacturer's descriptive name, shown so the picker isn't a wall of style codes. */
  title?: string | null;
  colorName?: string;
  unitCostMinor: number;
  isDark: boolean;
  available: boolean;
};

type Props = {
  pricingConfig: PricingConfigV2;
  catalogProducts?: CatalogOption[];
  initialMethod?: string;
  initialQty?: number;
};

export function QuoteBuilder({
  pricingConfig,
  catalogProducts = [],
  initialMethod,
  initialQty = 48,
}: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [addedToCart, setAddedToCart] = useState(false);
  const useCatalog = catalogProducts.length > 0;

  // Methods, their rates and their options all come from the published
  // pricing config, so adding a method in the admin panel offers it here
  // without a code change.
  const methods = useMemo(
    () =>
      [...pricingConfig.methods]
        .filter((entry) => entry.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [pricingConfig],
  );

  // Group colourways of the same garment under one style, so "Pick your
  // product" offers one button per garment instead of one per colour.
  const styleGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; title: string | null; colours: CatalogOption[] }
    >();
    for (const p of catalogProducts) {
      const key = p.brandName && p.styleName ? `${p.brandName}::${p.styleName}` : p.id;
      const label = p.brandName && p.styleName ? `${p.brandName} ${p.styleName}`.trim() : p.label;
      if (!groups.has(key)) groups.set(key, { key, label, title: p.title ?? null, colours: [] });
      groups.get(key)!.colours.push(p);
    }
    return [...groups.values()];
  }, [catalogProducts]);
  const hasStyleGroups = styleGroups.some((g) => g.colours.length > 1);

  const [selectedStyleKey, setSelectedStyleKey] = useState(
    styleGroups[0]?.key ?? "",
  );
  const [catalogProductId, setCatalogProductId] = useState(
    catalogProducts[0]?.id ?? "",
  );
  const activeStyleGroup =
    styleGroups.find((g) => g.key === selectedStyleKey) ?? styleGroups[0];

  function selectStyle(key: string) {
    setSelectedStyleKey(key);
    const group = styleGroups.find((g) => g.key === key);
    const nextColour = group?.colours.find((c) => c.available) ?? group?.colours[0];
    if (nextColour) setCatalogProductId(nextColour.id);
  }
  const [product, setProduct] = useState<QbProduct>("T-Shirts");
  const [qty, setQty] = useState(initialQty);
  const [locations, setLocations] = useState<string[]>(["front"]);
  const [methodKey, setMethodKey] = useState<string>(
    () =>
      methods.find((entry) => entry.key === initialMethod)?.key ??
      methods[0]?.key ??
      "",
  );
  const [colours, setColours] = useState<number | "unsure">(1);
  const [stitchPreset, setStitchPreset] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [optionKey, setOptionKey] = useState<string>("");
  const [showMore, setShowMore] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rush, setRush] = useState(false);
  const [includePacking, setIncludePacking] = useState(true);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const needsArtworkReview = colours === "unsure";
  const effectiveColours = colours === "unsure" ? 1 : colours;

  const selectedMethod = useMemo(
    () => methods.find((entry) => entry.key === methodKey) ?? methods[0],
    [methods, methodKey],
  );

  const selectedCatalog = useCatalog
    ? catalogProducts.find((p) => p.id === catalogProductId) ?? catalogProducts[0]
    : null;

  const buildQuote = useCallback(
    (quantity: number): QuoteInputV2 => ({
      garments: [
        {
          id: "garment",
          description: selectedCatalog?.label ?? product,
          unitCostMinor: selectedCatalog
            ? selectedCatalog.unitCostMinor
            : QB_PRODUCT_COST_MINOR[product],
          quantity,
          colourName: selectedCatalog?.colorName ?? "",
          isDark: selectedCatalog
            ? selectedCatalog.isDark
            : QB_PRODUCT_IS_DARK[product],
        },
      ],
      decorations: locations.map((location) => ({
        id: `decoration-${location}`,
        garmentId: "garment",
        methodKey: selectedMethod?.key ?? "",
        location,
        // One design across every placement, so the setup fee is charged once.
        logoGroup: "primary",
        colours: variableInputFor(selectedMethod).colours
          ? effectiveColours
          : undefined,
        variableValue: variableInputFor(selectedMethod).stitches
          ? STITCH_PRESETS.find((p) => p.id === stitchPreset)?.stitches
          : undefined,
        optionKey: variableInputFor(selectedMethod).option
          ? optionKey || defaultOptionKey(selectedMethod)
          : undefined,
        isOversized: false,
        artwork: { isRepeat: false, verifiedByStaff: false },
      })),
      options: {
        rush,
        designHours: 0,
        includePacking,
        shippingCostMinor: 0,
      },
    }),
    [
      product,
      selectedCatalog,
      locations,
      selectedMethod,
      effectiveColours,
      stitchPreset,
      optionKey,
      rush,
      includePacking,
    ],
  );

  const quoteInput = useMemo(() => buildQuote(qty), [buildQuote, qty]);

  const breakdown = useMemo(
    () => calculateQuoteV2(quoteInput, pricingConfig),
    [quoteInput, pricingConfig],
  );

  const perPieceMinor = breakdown.garments[0]?.unitPriceMinor ?? 0;

  /**
   * Prices the same order at the next quantity break using the engine itself,
   * so the saving quoted here is the saving the customer actually gets.
   */
  const tierNudge = useMemo(() => {
    const nextBreak = selectedMethod?.rateModel.qtyAnchors.find(
      (anchor) => anchor > qty,
    );
    if (!nextBreak) return null;
    const atNextBreak = calculateQuoteV2(buildQuote(nextBreak), pricingConfig);
    const nextPerPiece = atNextBreak.garments[0]?.unitPriceMinor ?? 0;
    const saving = perPieceMinor - nextPerPiece;
    if (saving <= 0) return null;
    return `Order ${nextBreak}+ and save ${moneyFromMinor(saving)} per piece.`;
  }, [selectedMethod, qty, buildQuote, pricingConfig, perPieceMinor]);

  const oneTimeLines = breakdown.lines.filter((line) =>
    ["setup", "design", "artworkMinimum"].includes(line.kind),
  );
  const oneTimeFeesMinor = oneTimeLines.reduce(
    (sum, line) => sum + line.extendedAmountMinor,
    0,
  );

  function toggleLocation(id: string) {
    setLocations((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }

  function addQuoteToCart() {
    const label = useCatalog && selectedCatalog ? selectedCatalog.label : product;
    addItem({
      id:
        useCatalog && selectedCatalog
          ? selectedCatalog.id
          : `custom-quote-${product}-${methodKey}-${Date.now()}`,
      productId: useCatalog && selectedCatalog ? selectedCatalog.id : undefined,
      name: label,
      meta: `${selectedMethod?.label ?? methodKey} · ${locations
        .map((l) => LOCATIONS.find((loc) => loc.id === l)?.label ?? l)
        .join(", ")}${needsArtworkReview ? " · Artwork review needed" : ""}`,
      color: "As quoted",
      qty,
      unit: perPieceMinor / 100,
      image: "",
      pricingSnapshot: {
        schemaVersion: 2,
        input: quoteInput,
        breakdown,
        pricingConfigVersion: pricingConfig.version,
      },
    });
    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
      router.push("/checkout");
    }, 700);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(customInput, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setCustomError("Enter a quantity greater than 0.");
      return;
    }
    setCustomError(null);
    setQty(n);
    setIsCustom(true);
  }

  return (
    <div id="quote" className="grid grid-cols-1 lg:grid-cols-2 gap-sp-5 items-start">
      <div className="bg-bg-raised border border-border rounded-lg shadow-card p-sp-5">
        <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-3">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Live Quote Builder
        </div>
        <h2 className="font-display font-bold text-header leading-header mb-sp-1">
          Three answers. Instant estimate.
        </h2>
        <p className="text-sm text-text-secondary mb-sp-4">
          Customize your order and see the price update live.
        </p>

        {/* Step Progress */}
        <div className="flex items-center gap-sp-2 mb-sp-6 text-xs font-semibold">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center gap-sp-2 flex-1">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px]",
                  step <= 3 ? "bg-accent" : "bg-border text-text-tertiary",
                )}
              >
                {step}
              </div>
              {step < 3 && (
                <div className={cn("flex-1 h-0.5", step < 3 ? "bg-border" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        <QbRow label="1. Pick your product">
          {useCatalog && hasStyleGroups
            ? styleGroups.map((g) => (
                <Pill
                  key={g.key}
                  active={selectedStyleKey === g.key}
                  onClick={() => selectStyle(g.key)}
                >
                  {g.title ? (
                    <span className="flex flex-col items-start leading-tight">
                      <span>{g.title}</span>
                      <span className="text-[11px] font-normal opacity-70">
                        {g.label}
                      </span>
                    </span>
                  ) : (
                    g.label
                  )}
                </Pill>
              ))
            : useCatalog
              ? catalogProducts.map((p) => (
                  <Pill
                    key={p.id}
                    active={catalogProductId === p.id}
                    onClick={() => setCatalogProductId(p.id)}
                  >
                    {p.label}
                    {!p.available ? " (unavailable)" : ""}
                  </Pill>
                ))
              : QB_PRODUCTS.map((p) => (
                  <Pill key={p} active={product === p} onClick={() => setProduct(p)}>
                    {p}
                  </Pill>
                ))}
        </QbRow>

        {useCatalog && hasStyleGroups && activeStyleGroup && activeStyleGroup.colours.length > 1 && (
          <QbRow label="Colour">
            {activeStyleGroup.colours.map((c) => (
              <Pill
                key={c.id}
                active={catalogProductId === c.id}
                onClick={() => setCatalogProductId(c.id)}
              >
                {c.colorName || c.label}
                {!c.available ? " (unavailable)" : ""}
              </Pill>
            ))}
          </QbRow>
        )}

        <QbRow label="2. How many?">
          {QB_QTY_OPTIONS.map((q) => (
            <Pill
              key={q}
              active={!isCustom && qty === q}
              onClick={() => {
                setQty(q);
                setIsCustom(false);
                setCustomInput("");
                setCustomError(null);
              }}
            >
              {q}
              {q === 500 ? "+" : ""}
            </Pill>
          ))}
        </QbRow>
        {tierNudge && (
          <p className="text-[12.5px] text-accent font-semibold -mt-2 mb-sp-3">
            {tierNudge}
          </p>
        )}

        <div className="mb-sp-4">
          <label className="block text-xs font-bold tracking-[0.1em] uppercase text-text-tertiary mb-sp-2">
            Or enter an exact quantity
          </label>
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (customError) setCustomError(null);
              }}
              placeholder="e.g. 340"
              className="flex-1 min-w-0 min-h-11 border border-border rounded-sm bg-bg-raised px-3.5 py-2.5 text-base font-body font-semibold text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 min-h-11 rounded-sm border border-accent bg-accent text-white text-base font-bold hover:bg-accent/90 transition-colors shrink-0"
            >
              Apply
            </button>
          </form>
          {customError && (
            <p className="text-[12.5px] text-red-600 font-semibold mt-1.5">{customError}</p>
          )}
        </div>

        <QbRow label="3. Where does your design go?">
          {LOCATIONS.map((loc) => (
            <Pill
              key={loc.id}
              active={locations.includes(loc.id)}
              onClick={() => toggleLocation(loc.id)}
            >
              {loc.label}
            </Pill>
          ))}
        </QbRow>

        <button
          type="button"
          className="text-sm font-bold text-accent mb-sp-3"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Hide optional details" : "Printing method & more options"}
        </button>

        {showMore && (
          <div className="border-t border-border pt-sp-4 space-y-sp-4">
            <div>
              <label className="block text-xs font-bold tracking-[0.1em] uppercase text-text-tertiary mb-sp-3">
                Printing method
              </label>
              <div className="space-y-2">
                {methods.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setMethodKey(m.key);
                      setOptionKey(defaultOptionKey(m));
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-sm border transition-colors",
                      methodKey === m.key
                        ? "bg-accent border-accent text-white"
                        : "bg-bg-raised border-border text-text-primary hover:border-text-tertiary",
                    )}
                  >
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className="text-[12px] opacity-70 mt-0.5">
                      {m.description || METHOD_BLURBS[m.key] || ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {variableInputFor(selectedMethod).colours && (
              <QbRow label="How many colours in your design?">
                {colourOptions(selectedMethod).map((c) => (
                  <Pill
                    key={c}
                    round
                    active={colours === c}
                    onClick={() => setColours(c)}
                  >
                    {c}
                  </Pill>
                ))}
                <Pill
                  active={colours === "unsure"}
                  onClick={() => setColours("unsure")}
                >
                  Not sure
                </Pill>
              </QbRow>
            )}

            {variableInputFor(selectedMethod).stitches && (
              <QbRow label="Logo size">
                {STITCH_PRESETS.map((p) => (
                  <Pill
                    key={p.id}
                    active={stitchPreset === p.id}
                    onClick={() => setStitchPreset(p.id)}
                  >
                    {p.label}
                  </Pill>
                ))}
              </QbRow>
            )}

            {selectedMethod?.rateModel.kind === "matrixByOption" && (
              <QbRow label="Transfer size">
                {selectedMethod.rateModel.options.map((option) => (
                  <Pill
                    key={option.key}
                    active={
                      (optionKey || defaultOptionKey(selectedMethod)) ===
                      option.key
                    }
                    onClick={() => setOptionKey(option.key)}
                  >
                    {option.label}
                  </Pill>
                ))}
              </QbRow>
            )}

            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePacking}
                  onChange={(e) => setIncludePacking(e.target.checked)}
                />
                Include packing
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rush}
                  onChange={(e) => setRush(e.target.checked)}
                />
                Rush production
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="bg-text-primary text-white rounded-lg overflow-hidden sticky top-[calc(var(--header-offset)+12px)]">
        <div className="h-[140px] relative bg-[linear-gradient(135deg,#2a2a28,#0d0d0d)]">
          <OptionalImage
            src="/images/prod-hoodie.jpg"
            alt="Product photography"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute left-sp-4 bottom-sp-3">
            <div className="font-display text-sm font-bold opacity-90">{product.toUpperCase()}</div>
            <div className="text-[11px] text-white/70 mt-1">
              {locations.join(" · ")} · {selectedMethod?.label ?? methodKey}
            </div>
          </div>
        </div>

        <div className="p-sp-5 bg-fill-subtle text-text-primary space-y-sp-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Live Estimate
          </div>

          <div>
            <div className="text-[13px] text-text-secondary mb-1">Per shirt</div>
            <div className="text-[28px] font-display font-bold text-text-primary">
              <AnimatedNumber value={perPieceMinor / 100} />
            </div>
          </div>

          <div className="border-t border-border pt-sp-4">
            <div className="text-[12px] text-text-secondary mb-2">Order total</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-display font-bold text-accent">
                <AnimatedNumber value={breakdown.totals.totalMinor / 100} />
              </span>
              <span className="text-[12px] text-text-secondary">
                for {qty.toLocaleString()} {qty === 1 ? "piece" : "pieces"}
              </span>
            </div>
          </div>

          {oneTimeLines.length > 0 && (
            <div className="border border-border rounded-sm bg-bg-raised overflow-hidden">
              <button
                type="button"
                className="w-full flex justify-between items-center px-4 py-3 text-sm font-semibold hover:bg-fill-subtle-15 transition-colors"
                onClick={() => setSetupOpen((v) => !v)}
              >
                <span>
                  One-time setup: {moneyFromMinor(oneTimeFeesMinor)}
                </span>
                <span className="text-[12px]">{setupOpen ? "▲" : "▼"}</span>
              </button>
              {setupOpen && (
                <ul className="px-4 pb-3 pt-2 text-[12px] text-text-secondary space-y-1.5 border-t border-border">
                  {oneTimeLines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-3">
                      <span>{line.label}</span>
                      <span className="font-semibold text-text-primary">
                        {moneyFromMinor(line.extendedAmountMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="text-[12px] text-text-secondary space-y-1">
            <div>
              ⏱️{" "}
              {QB_METHOD_DAYS[methodKey as keyof typeof QB_METHOD_DAYS] ??
                "Lead time confirmed with your quote"}
            </div>
            <div>📦 {qty.toLocaleString()} {qty === 1 ? "piece" : "pieces"}</div>
          </div>

          <p className="text-[11px] text-text-secondary italic">
            {needsArtworkReview
              ? "Estimated from a 1-colour print — final price confirmed by our team within 1 business day."
              : "Estimated from your selections — final price confirmed when we review your artwork."}
          </p>

          <Button className="w-full" onClick={addQuoteToCart}>
            {addedToCart ? "Added to cart ✓" : "Add to cart & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QbRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-sp-4">
      <label className="block text-xs font-bold tracking-[0.1em] uppercase text-text-tertiary mb-sp-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({
  children,
  active,
  round,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border font-semibold text-sm transition-all duration-200 text-left cursor-pointer",
        round
          ? "w-[38px] h-[38px] rounded-full grid place-items-center p-0 text-xs"
          : "px-4 py-2.5 rounded-md",
        active
          ? "bg-accent border-accent text-white shadow-md scale-[1.02]"
          : "bg-bg-raised border-border text-text-primary hover:border-text-secondary hover:shadow-sm hover:scale-[1.01]",
      )}
    >
      {children}
    </button>
  );
}
