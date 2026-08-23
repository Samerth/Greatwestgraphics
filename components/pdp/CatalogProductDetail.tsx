"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/shared/Button";
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
  const availableVariants = useMemo(
    () => variants.filter((v) => v.active !== false && Number(v.qty || 0) > 0),
    [variants],
  );
  const selected = availableVariants[0];
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

        <div className="mt-sp-4 flex flex-col sm:flex-row gap-3">
          <ButtonLink
            href={`/design?garmentId=${encodeURIComponent(productId)}`}
            className="w-full sm:w-auto"
          >
            Design this
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
