"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/shared/Button";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import {
  QB_PRODUCTS,
  QB_QTY_OPTIONS,
  QB_METHODS,
  calculateQuote,
  type QbProduct,
  type QbMethod,
} from "@/lib/utils/quote-pricing";

const INK_OPTIONS = [1, 2, 3, 4, 5, 6];

export function QuoteBuilder() {
  const [product, setProduct] = useState<QbProduct>("T-Shirts");
  const [qty, setQty] = useState<number>(48);
  const [method, setMethod] = useState<QbMethod>("Screen Print");
  const [ink, setInk] = useState<number>(2);
  const [locked, setLocked] = useState(false);

  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const { perUnit, total, savePct, turnaround } = calculateQuote({
    product,
    qty,
    method,
    ink,
  });

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

  function selectPreset(q: number) {
    setQty(q);
    setIsCustom(false);
    setCustomInput("");
    setCustomError(null);
  }

  return (
    <div id="quote" className="grid grid-cols-1 lg:grid-cols-2 gap-sp-5 items-start">
      <div className="bg-bg-raised border border-border rounded-lg shadow-card p-sp-5">
        <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Live Quote Builder
        </div>
        <h2 className="font-display font-bold text-header leading-header mb-sp-4">
          Watch your price build itself.
        </h2>

        <QbRow label="Product">
          {QB_PRODUCTS.map((p) => (
            <Pill key={p} active={product === p} onClick={() => setProduct(p)}>
              {p}
            </Pill>
          ))}
        </QbRow>

        <QbRow label="Quantity">
          {QB_QTY_OPTIONS.map((q) => (
            <Pill key={q} active={!isCustom && qty === q} onClick={() => selectPreset(q)}>
              {q}
              {q === 500 ? "+" : ""}
            </Pill>
          ))}
        </QbRow>

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
          {isCustom && !customError && (
            <p className="text-[12.5px] text-accent font-semibold mt-1.5">
              Pricing custom quantity: {qty.toLocaleString()} pieces
            </p>
          )}
        </div>

        <QbRow label="Print Method">
          {QB_METHODS.map((m) => (
            <Pill key={m} active={method === m} onClick={() => setMethod(m)}>
              {m}
            </Pill>
          ))}
        </QbRow>

        <QbRow label="Ink Colours">
          {INK_OPTIONS.map((i) => (
            <Pill key={i} round active={ink === i} onClick={() => setInk(i)}>
              {i}
            </Pill>
          ))}
        </QbRow>
        <p className="text-[12.5px] text-text-tertiary -mt-2">
          <span className="text-accent">●</span> Pricing drops automatically at 50, 100
          and 250+ units.
        </p>
      </div>

      <div className="bg-text-primary text-white rounded-lg overflow-hidden">
        <div className="h-[140px] relative bg-[linear-gradient(135deg,#2a2a28,#0d0d0d)]">
          <Image
            src="/images/prod-hoodie.jpg"
            alt="Product photography"
            fill
            className="object-cover"
          />
          <div className="absolute left-sp-3 top-sp-3">
            <b className="block font-display text-[15px]">{product.toUpperCase()}</b>
            <span className="text-xs text-white/60">Product photography</span>
          </div>
        </div>

        <div className="p-sp-4 bg-fill-subtle text-text-primary">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-accent mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Live Estimate
          </div>

          <div className="flex justify-between items-center py-2">
            <span>Per unit</span>
            <b>
              <AnimatedNumber value={perUnit} />
            </b>
          </div>
          <div className="flex justify-between items-center py-2 font-display text-[22px] font-bold">
            <span className="text-body font-body font-normal">Estimated total</span>
            <span className="text-accent">
              <AnimatedNumber value={total} />
            </span>
          </div>

          <div className="text-[12.5px] text-text-secondary my-1.5 mb-sp-3">
            {turnaround} · {qty.toLocaleString()} {qty === 1 ? "piece" : "pieces"}
          </div>

          <div className="flex gap-2 flex-wrap mb-sp-3">
            <span className="text-xs font-bold bg-bg-raised border border-accent text-accent rounded-sm px-2.5 py-1.5">
              {qty > 24
                ? `Saving ${Math.max(savePct, 0)}% vs. our 24-unit base price`
                : "Base pricing shown for a 24-unit order"}
            </span>
            <span className="text-xs font-bold bg-bg-raised border border-border rounded-sm px-2.5 py-1.5">
              Free digital proof
            </span>
          </div>

          <Button
            className="w-full"
            disabled={locked}
            onClick={() => {
              setLocked(true);
              setTimeout(() => setLocked(false), 550);
            }}
          >
            {locked ? "Queuing proof request…" : "Lock This Quote →"}
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
      onClick={onClick}
      className={cn(
        "border font-semibold text-sm transition-colors",
        round
          ? "w-[38px] h-[38px] rounded-full grid place-items-center p-0 text-xs"
          : "px-4 py-2.5 rounded-sm",
        active
          ? "bg-accent border-accent text-white"
          : "bg-bg-raised border-border text-text-primary hover:border-text-tertiary"
      )}
    >
      {children}
    </button>
  );
}