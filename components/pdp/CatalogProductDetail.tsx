"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/shared/Button";
import { useCartStore } from "@/lib/store/cart";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

type Variant = {
  id: string;
  sizeName: string;
  qty: number;
  active: boolean;
  retailMinor: number;
  costMinor: number;
  sku?: string | null;
};

type CatalogProductDetailProps = {
  productId: string;
  brandName: string;
  styleName: string;
  colorName: string;
  isDark: boolean;
  imageUrl: string | null;
  productActive: boolean;
  productQty: number;
  variants: Variant[];
};

export function CatalogProductDetail({
  productId,
  brandName,
  styleName,
  colorName,
  isDark,
  imageUrl,
  productActive,
  productQty,
  variants,
}: CatalogProductDetailProps) {
  const addItem = useCartStore((s) => s.addItem);
  const availableVariants = useMemo(
    () => variants.filter((v) => v.active !== false && Number(v.qty || 0) > 0),
    [variants]
  );
  const [sizeId, setSizeId] = useState(availableVariants[0]?.id || "");
  const [qty, setQty] = useState(24);
  const [justAdded, setJustAdded] = useState(false);

  const selected = variants.find((v) => v.id === sizeId) || availableVariants[0];
  const unit = selected ? Number(selected.retailMinor || 0) / 100 : 0;
  const productAvailable =
    productActive && productQty > 0 && availableVariants.length > 0;

  return (
    <div className="grid lg:grid-cols-2 gap-sp-5">
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-bg-raised">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${brandName} ${styleName}`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ) : (
          <div className="absolute inset-0 bg-fill-subtle-15" />
        )}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          {brandName}
        </p>
        <h1 className="font-display font-bold text-display-sm m-0 mt-1">
          {styleName}
        </h1>
        <p className="text-text-secondary mt-2 mb-0">
          {colorName}
          {isDark ? " · Dark garment" : ""}
        </p>
        <p className="text-lg font-bold mt-sp-3 mb-0">
          {productAvailable
            ? `from ${moneyFromMinor(Number(selected?.retailMinor || 0))}`
            : "Unavailable"}
        </p>

        <p className="text-sm font-bold mt-sp-4 mb-2">Size</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const inStock = v.active !== false && Number(v.qty || 0) > 0;
            return (
              <button
                key={v.id}
                type="button"
                disabled={!inStock}
                onClick={() => setSizeId(v.id)}
                className={`border rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors ${
                  sizeId === v.id
                    ? "bg-accent text-white border-accent"
                    : inStock
                      ? "border-border hover:border-text-tertiary"
                      : "border-amber-300 text-amber-800 bg-amber-50 opacity-60 cursor-not-allowed"
                }`}
              >
                {v.sizeName}
                {!inStock ? " · Unavailable" : ""}
              </button>
            );
          })}
        </div>

        <p className="text-sm font-bold mt-sp-4 mb-2">Quantity</p>
        <div className="flex flex-wrap gap-2 mb-sp-4">
          {[12, 24, 48, 96, 250].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQty(preset)}
              className={`min-w-[54px] h-10 px-3 border rounded-sm font-bold text-[13px] ${
                qty === preset
                  ? "bg-accent text-white border-accent"
                  : "border-border bg-bg-raised"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="w-full sm:w-auto"
            disabled={!productAvailable || !selected}
            onClick={() => {
              if (!selected) return;
              addItem({
                id: productId,
                productId,
                variantId: selected.id,
                name: `${brandName} ${styleName}`.trim(),
                meta: selected.sku
                  ? `SKU ${selected.sku} · Size ${selected.sizeName}`
                  : `Size ${selected.sizeName}`,
                color: colorName,
                size: selected.sizeName,
                qty,
                unit,
                image: imageUrl || "/images/t-shirt_4.jpg",
              });
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 2000);
            }}
          >
            {justAdded
              ? "Added ✓"
              : `Add ${qty.toLocaleString()} Piece${qty === 1 ? "" : "s"} to Cart`}
          </Button>
          <ButtonLink href="/design" variant="secondary">
            Design this blank
          </ButtonLink>
          <Link
            href="/products"
            className="inline-flex items-center text-sm font-bold text-accent"
          >
            Back to catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
