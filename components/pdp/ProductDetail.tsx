"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { RecolorGarment } from "./RecolorGarment";
import { Button } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { CATALOG } from "@/lib/data/products";

const VIEWS = ["Front", "Back"];
const QTY_OPTIONS = [24, 48, 96, 250, 500];
const COLORS = [
  { name: "Black", hex: "#1b1b1b" },
  { name: "Rust", hex: "#8a3a1e" },
  { name: "Steel", hex: "#48586c" },
  { name: "Sunflower", hex: "#e0b23a" },
];
const SIZES = ["S", "M", "L", "XL", "2XL"];

export function ProductDetail({ slug }: { slug: string }) {
  const product = CATALOG.find((item) => item.slug === slug) ?? CATALOG[0];
  const unitPrice =
    Number.parseFloat(product.priceFrom.replace(/[^0-9.]/g, "")) || 9.2;
  const isWearable = ["Apparel", "Outerwear", "Polos", "Safety"].includes(
    product.category
  );
  const garmentMask =
    product.slug.includes("hood") || product.slug.includes("outerwear")
      ? "/images/hoodie.png"
      : "/images/t-shirt.png";
  const cartImage = getProductImage(product.slug, product.category);

  const [view, setView] = useState(VIEWS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState<number>(48);
  const [isCustomQty, setIsCustomQty] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const [justAdded, setJustAdded] = useState(false);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-6">
      <div>
        <div className="relative aspect-square rounded-lg border border-border bg-bg-raised flex items-center justify-center overflow-hidden">
          {isWearable ? (
            <RecolorGarment
              maskSrc={garmentMask}
              color={color.hex}
              className={cn(
                "w-3/5 h-3/5 transition-transform duration-med",
                view === "Back" && "-scale-x-100"
              )}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cartImage}
              alt={product.name}
              className="w-4/5 h-4/5 object-contain"
            />
          )}
          <span className="absolute left-sp-3 bottom-sp-3 rounded-full border border-border bg-bg-raised/90 px-3 py-1 text-xs font-bold">
            {isWearable
              ? view === "Back"
                ? "Representative back silhouette"
                : "Representative front silhouette"
              : "Product image"}
          </span>
        </div>
        {isWearable && (
          <div className="flex gap-2 mt-sp-3">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "border rounded-sm px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  v === view ? "bg-accent text-white border-accent" : "bg-bg-raised border-border hover:border-text-tertiary"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="font-display font-bold text-header leading-header mb-sp-2">
          {product.name}
        </h1>
        <p className="text-text-secondary mb-sp-4">
          {product.sub ??
            `Production-ready ${product.category.toLowerCase()} selected for reliable decoration and repeat orders.`}
        </p>

        <div className="bg-fill-subtle-15 border border-border rounded-md p-sp-3 mb-sp-4 text-sm space-y-1.5">
          <SpecRow
            k="Decoration area"
            v={isWearable ? `4" × 4" chest, 10" × 12" back` : "Confirmed with proof"}
          />
          <SpecRow k="Category" v={product.category} />
          <SpecRow k="Minimum quantity" v="12 units" />
          <SpecRow k="Turnaround" v="5–7 business days" />
        </div>

        {isWearable && (
          <>
            <span className="text-sm font-bold block mb-2">
              Color: <span className="font-normal">{color.name}</span>
            </span>
            <div className="flex gap-2.5 mb-sp-4">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c)}
                  style={{ background: c.hex }}
                  aria-label={c.name}
                  className={cn(
                    "w-[34px] h-[34px] rounded-full border-2 border-white shadow-[0_0_0_1px_var(--color-border)] transition-transform hover:scale-105",
                    color.name === c.name && "shadow-[0_0_0_2px_var(--color-accent)]"
                  )}
                />
              ))}
            </div>

            <span className="text-sm font-bold block mb-2">
              Size: <span className="font-normal">{size}</span>
            </span>
            <div className="flex gap-2 flex-wrap mb-sp-4">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "w-11 h-10 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                    s === size ? "bg-accent text-white border-accent" : "border-border hover:border-text-tertiary"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        <span className="text-sm font-bold block mb-2">
          Quantity: <span className="font-normal">{qty.toLocaleString()}{qty === 500 && !isCustomQty ? "+" : ""} pieces</span>
        </span>
        <div className="flex gap-2 flex-wrap mb-sp-2.5">
          {QTY_OPTIONS.map((q) => (
            <button
              key={q}
              onClick={() => selectPresetQty(q)}
              className={cn(
                "min-w-[54px] h-10 px-3 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                !isCustomQty && q === qty ? "bg-accent text-white border-accent" : "border-border bg-bg-raised hover:border-text-tertiary"
              )}
            >
              {q}{q === 500 ? "+" : ""}
            </button>
          ))}
        </div>

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
          <p className="text-[12.5px] text-red-600 font-semibold -mt-sp-3 mb-sp-4">{customError}</p>
        )}

        <div className="flex flex-col gap-2.5">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              addItem({
                id: slug,
                name: product.name,
                meta: `${product.tags[0]?.label ?? "Custom decoration"}${
                  isWearable ? ` · Size ${size}` : ""
                }`,
                color: isWearable ? color.name : "As shown",
                qty,
                unit: unitPrice,
                image: cartImage,
              });
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 2000);
            }}
          >
            {justAdded ? "Added ✓" : `Add ${qty.toLocaleString()} Piece${qty === 1 ? "" : "s"} to Cart`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getProductImage(slug: string, category: string) {
  if (slug.includes("hood") || slug.includes("outerwear")) return "/images/prod-hoodie.jpg";
  if (slug.includes("cap") || category === "Headwear") return "/images/caps.jpg";
  if (category === "Safety") return "/images/prod-safety.jpg";
  if (category === "Bags") return "/images/prod-tote.jpg";
  if (category === "Promo") return "/images/prod-promo.jpg";
  if (category === "Signs") return "/images/display.jpg";
  return "/images/t-shirt_4.jpg";
}

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{k}</span>
      <b>{v}</b>
    </div>
  );
}