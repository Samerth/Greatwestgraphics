"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CatalogImage } from "@/components/shared/CatalogImage";
import type { PricingConfigV2 } from "@gwg/contracts";
import { cn } from "@/lib/utils/cn";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";
import { catalogCardPricing } from "@/lib/commerce/catalog-card";
import {
  bestSellerSectionHeading,
  bestSellerViewAllHref,
  type BestSellerSection,
} from "@/lib/commerce/best-sellers";
import { CatalogColorSwatches } from "@/components/products/CatalogColorSwatches";
import { useBrowsingQuantity } from "@/lib/store/browsing-quantity";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";

/**
 * Best Sellers, one row per category (UAT V2 row 68).
 *
 * Prices come from `catalogCardPricing`, the same function the main catalogue
 * grid and the homepage teaser use, so a product shows the same figure
 * wherever its card appears. That was explicit in row 53 and is the reason
 * this page does not compute anything of its own.
 */
export function BestSellersSections({
  sections,
  pricingConfig,
}: {
  sections: BestSellerSection[];
  pricingConfig: PricingConfigV2 | null;
}) {
  if (sections.length === 0) {
    return (
      <p className="text-text-secondary">
        No best sellers are set yet. Assign products to the Best Sellers
        category in the admin catalogue and they will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-sp-7">
      {sections.map((section) => (
        <BestSellerRow
          key={section.slug}
          section={section}
          pricingConfig={pricingConfig}
        />
      ))}
    </div>
  );
}

function BestSellerRow({
  section,
  pricingConfig,
}: {
  section: BestSellerSection;
  pricingConfig: PricingConfigV2 | null;
}) {
  return (
    <ProductCarouselRow
      anchor={section.anchor}
      heading={bestSellerSectionHeading(section)}
      scrollLabel={section.name}
      viewAllHref={bestSellerViewAllHref(section)}
      products={section.products}
      pricingConfig={pricingConfig}
    />
  );
}

/**
 * One horizontally scrolling row of product cards with a heading and a
 * "View all" link. Best Sellers is one row per category; a brand page uses
 * the same row for "Popular Gildan styles". Same card, same pricing.
 */
export function ProductCarouselRow({
  anchor,
  heading,
  scrollLabel,
  viewAllHref,
  viewAllLabel = "View all",
  products,
  pricingConfig,
}: {
  anchor?: string;
  heading: string;
  /** Used in the arrows' accessible names: "Scroll Hoodies forward". */
  scrollLabel?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  products: StorefrontCatalogProduct[];
  pricingConfig: PricingConfigV2 | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Arrows are only useful when there is somewhere to go, and a row of three
  // products on a wide screen has nowhere. Measured rather than assumed from
  // the product count, because how many fit depends on the viewport.
  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setAtStart(node.scrollLeft <= 2);
    setAtEnd(max <= 2 || node.scrollLeft >= max - 2);
  }, []);

  useEffect(() => {
    measure();
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const step = useCallback((direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  const hasOverflow = !(atStart && atEnd);

  return (
    <section id={anchor} className="scroll-mt-[120px]">
      <div className="flex flex-wrap items-center justify-between gap-sp-2 mb-sp-3">
        <h2 className="font-display font-bold text-[22px] m-0">
          {heading}
        </h2>
        <div className="flex items-center gap-2">
          {hasOverflow && (
            <>
              <button
                type="button"
                aria-label={`Scroll ${scrollLabel ?? heading} back`}
                onClick={() => step(-1)}
                disabled={atStart}
                className="h-8 w-8 rounded-full border border-border grid place-items-center text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text-secondary"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={`Scroll ${scrollLabel ?? heading} forward`}
                onClick={() => step(1)}
                disabled={atEnd}
                className="h-8 w-8 rounded-full border border-border grid place-items-center text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text-secondary"
              >
                ›
              </button>
            </>
          )}
          <Link
            href={viewAllHref}
            className="rounded-sm border border-border px-3 py-1.5 text-[13px] font-bold transition-colors hover:border-accent hover:text-accent"
          >
            {viewAllLabel}
          </Link>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={measure}
        data-best-sellers="row"
        className="flex gap-sp-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1
                   [scrollbar-width:thin]"
      >
        {products.map((product) => (
          <BestSellerCard
            key={product.id}
            product={product}
            pricingConfig={pricingConfig}
          />
        ))}
      </div>
    </section>
  );
}

function BestSellerCard({
  product,
  pricingConfig,
}: {
  product: StorefrontCatalogProduct;
  pricingConfig: PricingConfigV2 | null;
}) {
  const qty = useBrowsingQuantity((s) => s.qty);
  // Rendered on the server first, where there is no persisted browsing
  // quantity, so the estimate is computed only once mounted. Without this the
  // server and client disagree on the price and React discards the markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pricing = catalogCardPricing(product, pricingConfig, qty);
  const showEstimate = mounted && pricing.isEstimate;

  return (
    <article className="snap-start shrink-0 w-[248px] sm:w-[268px] border border-border rounded-md bg-bg-raised overflow-hidden flex flex-col">
      <Link href={`/product/${product.slug}`} className="block">
        {/* White ground, matching the product photography, so the garment is
            not pasted onto a grey tile (UAT row 19). */}
        <div className="relative aspect-square bg-white">
          {product.imageUrl ? (
            <CatalogImage
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="268px"
              className="object-contain"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-text-tertiary">
              No image
            </div>
          )}
          {product.isBestSeller && (
            <span className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Best seller
            </span>
          )}
        </div>
      </Link>

      <div className="p-sp-3 flex flex-col gap-1.5 flex-1">
        <CatalogColorSwatches
          swatches={product.colorSwatches}
          colorwayCount={product.colorwayCount}
        />
        <Link
          href={`/product/${product.slug}`}
          className="font-semibold text-[14px] leading-snug hover:text-accent transition-colors"
        >
          {product.name}
        </Link>
        <p className="m-0 text-[12px] text-text-tertiary">
          {product.brandName}
          {product.sizeRange ? ` · ${product.sizeRange}` : ""}
        </p>

        <div className="mt-auto pt-1.5">
          {showEstimate ? (
            <div className="flex items-center gap-1.5 rounded-sm bg-accent-tint px-2 py-1.5">
              <span className="text-[12.5px] font-semibold text-accent tabular-nums">
                {qty} items: {pricing.text.replace(/^from /, "")}
              </span>
              <PricingDetailsPopover
                quantityBreaks={pricing.quantityBreaks}
                note={
                  pricing.methodLabel
                    ? `Priced as ${pricing.methodLabel}, one location.`
                    : undefined
                }
              />
            </div>
          ) : (
            <span className="text-[12.5px] font-semibold text-text-secondary">
              {product.priceFrom}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
