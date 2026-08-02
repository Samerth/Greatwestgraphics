"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { DecorationMethod, PricingConfig, QuoteInput } from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { useCartStore } from "@/lib/store/cart";
import {
  QB_METHODS,
  QB_METHOD_DAYS,
  QB_PRODUCT_COST_MINOR,
  QB_PRODUCT_IS_DARK,
  QB_PRODUCTS,
  QB_QTY_OPTIONS,
  calculateQuote,
  moneyFromMinor,
  type QbProduct,
} from "@/lib/utils/quote-pricing";

const LOCATIONS = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "leftChest", label: "Left chest" },
  { id: "sleeve", label: "Sleeve" },
] as const;

const COLOUR_OPTIONS = [1, 2, 3, 4] as const;
const STITCH_PRESETS = [
  { id: "small", stitches: 5000, label: "Small logo" },
  { id: "medium", stitches: 8000, label: "Medium logo" },
  { id: "large", stitches: 12000, label: "Large logo" },
] as const;
const DTF_SIZES = [
  { id: "small", label: "Small", hint: "Up to 4\"" },
  { id: "medium", label: "Medium", hint: "Up to 8\"" },
  { id: "large", label: "Large", hint: "Up to 12\"" },
  { id: "oversize", label: "Oversize", hint: "12\"+" },
] as const;

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
  pricingConfig: PricingConfig;
  catalogProducts?: CatalogOption[];
  initialMethod?: DecorationMethod;
  initialQty?: number;
};

export function QuoteBuilder({
  pricingConfig,
  catalogProducts = [],
  initialMethod = "screenPrint",
  initialQty = 48,
}: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [addedToCart, setAddedToCart] = useState(false);
  const useCatalog = catalogProducts.length > 0;

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
  const [method, setMethod] = useState<DecorationMethod>(initialMethod);
  const [colours, setColours] = useState<number | "unsure">(1);
  const [stitchPreset, setStitchPreset] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [dtfSize, setDtfSize] = useState<"small" | "medium" | "large" | "oversize">(
    "medium",
  );
  const [showMore, setShowMore] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rush, setRush] = useState(false);
  const [includePacking, setIncludePacking] = useState(true);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const needsArtworkReview = colours === "unsure";
  const effectiveColours = colours === "unsure" ? 1 : colours;

  const selectedCatalog = useCatalog
    ? catalogProducts.find((p) => p.id === catalogProductId) ?? catalogProducts[0]
    : null;

  const quoteInput: QuoteInput = useMemo(
    () => ({
      quantity: qty,
      garment: {
        unitCostMinor: selectedCatalog
          ? selectedCatalog.unitCostMinor
          : QB_PRODUCT_COST_MINOR[product],
        isDark: selectedCatalog
          ? selectedCatalog.isDark
          : QB_PRODUCT_IS_DARK[product],
      },
      decorations: locations.map((location) => ({
        method,
        location,
        colours: method === "screenPrint" ? effectiveColours : undefined,
        stitchCount:
          method === "embroidery"
            ? STITCH_PRESETS.find((p) => p.id === stitchPreset)?.stitches
            : undefined,
        size: method === "dtf" ? dtfSize : undefined,
        isOversized: false,
        isRepeatArtwork: false,
      })),
      options: {
        rush,
        designHours: 0,
        includePacking,
        shippingCostMinor: 0,
      },
      needsArtworkReview,
    }),
    [
      qty,
      product,
      selectedCatalog,
      locations,
      method,
      effectiveColours,
      stitchPreset,
      dtfSize,
      rush,
      includePacking,
      needsArtworkReview,
    ],
  );

  const breakdown = useMemo(
    () => calculateQuote(quoteInput, pricingConfig),
    [quoteInput, pricingConfig],
  );

  const tierNudge = useMemo(() => {
    const tiers = pricingConfig.screenPrintMatrix.qtyTiers;
    const next = tiers.find((tier) => tier.min > qty);
    if (!next || method !== "screenPrint") return null;
    const currentIdx = tiers.findIndex(
      (tier) => qty >= tier.min && (tier.max === null || qty <= tier.max),
    );
    const nextIdx = tiers.findIndex((tier) => tier.min === next.min);
    const colourKey = String(effectiveColours);
    const currentPrice =
      pricingConfig.screenPrintMatrix.pricesByColour[colourKey]?.[currentIdx];
    const nextPrice =
      pricingConfig.screenPrintMatrix.pricesByColour[colourKey]?.[nextIdx];
    if (currentPrice == null || nextPrice == null || nextPrice >= currentPrice) {
      return null;
    }
    const save = (currentPrice - nextPrice) / 100;
    return `Order ${next.min}+ and save ${moneyFromMinor(currentPrice - nextPrice)} per shirt on print.`;
  }, [qty, method, effectiveColours, pricingConfig]);

  const oneTimeLines = breakdown.lines.filter((line) =>
    ["setup", "digitizing", "artwork_minimum", "design"].includes(line.kind),
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
          : `custom-quote-${product}-${method}-${Date.now()}`,
      productId: useCatalog && selectedCatalog ? selectedCatalog.id : undefined,
      name: label,
      meta: `${QB_METHODS.find((m) => m.id === method)?.label ?? method} · ${locations
        .map((l) => LOCATIONS.find((loc) => loc.id === l)?.label ?? l)
        .join(", ")}${needsArtworkReview ? " · Artwork review needed" : ""}`,
      color: "As quoted",
      qty,
      unit: breakdown.perPieceMinor / 100,
      image: "",
      pricingSnapshot: {
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
        <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Live Quote Builder
        </div>
        <h2 className="font-display font-bold text-header leading-header mb-sp-4">
          Three answers. Instant estimate.
        </h2>

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
              className="flex-1 min-w-0 border border-border rounded-sm bg-bg px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-sm border border-accent bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors shrink-0"
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
          <div className="border-t border-border pt-sp-3 space-y-sp-4">
            <QbRow label="Printing method">
              {QB_METHODS.map((m) => (
                <Pill
                  key={m.id}
                  active={method === m.id}
                  onClick={() => setMethod(m.id)}
                >
                  <span className="block">{m.label}</span>
                  <span className="block text-[11px] font-medium opacity-80">
                    {m.blurb}
                  </span>
                </Pill>
              ))}
            </QbRow>

            {method === "screenPrint" && (
              <QbRow label="How many colours in your design?">
                {COLOUR_OPTIONS.map((c) => (
                  <Pill
                    key={c}
                    round
                    active={colours === c}
                    onClick={() => setColours(c)}
                  >
                    {c === 4 ? "4+" : c}
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

            {method === "embroidery" && (
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

            {method === "dtf" && (
              <QbRow label="Transfer size">
                {DTF_SIZES.map((s) => (
                  <Pill
                    key={s.id}
                    active={dtfSize === s.id}
                    onClick={() => setDtfSize(s.id)}
                  >
                    <span className="block">{s.label}</span>
                    <span className="block text-[11px] opacity-80">{s.hint}</span>
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

      <div className="bg-text-primary text-white rounded-lg overflow-hidden">
        <div className="h-[140px] relative bg-[linear-gradient(135deg,#2a2a28,#0d0d0d)]">
          <Image
            src="/images/prod-hoodie.jpg"
            alt="Product photography"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute left-sp-3 top-sp-3">
            <b className="block font-display text-[15px]">{product.toUpperCase()}</b>
            <span className="text-xs text-white/60">
              {locations.join(" · ")} · {method}
            </span>
          </div>
        </div>

        <div className="p-sp-4 bg-fill-subtle text-text-primary">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-accent mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Live Estimate
          </div>

          <div className="flex justify-between items-center py-2">
            <span>Per shirt</span>
            <b>
              <AnimatedNumber value={breakdown.perPieceMinor / 100} />
            </b>
          </div>
          <div className="flex justify-between items-center py-2 font-display text-[22px] font-bold">
            <span className="text-body font-body font-normal">Order total</span>
            <span className="text-accent">
              <AnimatedNumber value={breakdown.totalMinor / 100} />
            </span>
          </div>

          {oneTimeLines.length > 0 && (
            <div className="border border-border rounded-sm mb-sp-3">
              <button
                type="button"
                className="w-full flex justify-between items-center px-3 py-2 text-sm font-semibold"
                onClick={() => setSetupOpen((v) => !v)}
              >
                <span>
                  One-time setup: {moneyFromMinor(breakdown.oneTimeFeesMinor)}
                </span>
                <span>{setupOpen ? "⌃" : "⌄"}</span>
              </button>
              {setupOpen && (
                <ul className="px-3 pb-2 text-[12.5px] text-text-secondary space-y-1">
                  {oneTimeLines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-2">
                      <span>{line.label}</span>
                      <span>{moneyFromMinor(line.extendedAmountMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="text-[12.5px] text-text-secondary my-1.5 mb-sp-3">
            {QB_METHOD_DAYS[method]} · {qty.toLocaleString()}{" "}
            {qty === 1 ? "piece" : "pieces"}
          </div>

          <p className="text-[12.5px] text-text-secondary mb-sp-3">
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
        "border font-semibold text-sm transition-colors text-left",
        round
          ? "w-[38px] h-[38px] rounded-full grid place-items-center p-0 text-xs"
          : "px-4 py-2.5 rounded-sm",
        active
          ? "bg-accent border-accent text-white"
          : "bg-bg-raised border-border text-text-primary hover:border-text-tertiary",
      )}
    >
      {children}
    </button>
  );
}
