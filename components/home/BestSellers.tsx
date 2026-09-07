"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { PricingConfigV2 } from "@gwg/contracts";
import { Container } from "@/components/shared/Container";
import {
  catalogCardSubtitle,
  catalogCardPricing,
} from "@/lib/commerce/catalog-card";
import { studioColorwayFill } from "@/lib/commerce/studio-garments";
import { useBrowsingQuantity } from "@/lib/store/browsing-quantity";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";
import type { StorefrontCatalogProduct } from "@/lib/commerce/catalog";

/**
 * Mirrors the mockup's "Best sellers, ready to customize" section, right
 * after the category tiles. Sourced from `isBestSeller` — the same real,
 * admin-curated flag the header's "Best Sellers" nav link and
 * /products?category=best-sellers already use (UAT: "Best Seller products
 * should be manageable through the existing product/category administration
 * functionality; an automated sales-ranking algorithm is not required"), not
 * an invented "popular" ranking.
 *
 * Renders nothing when the list is empty rather than an empty section --
 * checked staging directly before building this: 0 products are currently
 * assigned to Best Sellers (the UAT doc's own open item, unresolved), so
 * this section will not appear until someone assigns products to it in
 * admin. Same pattern CategoryBrowse already uses for its own tiles/pills.
 *
 * Pricing reuses `catalogCardPricing` — the exact function the full
 * catalogue's cards use, at the same shared browsing quantity — rather than
 * a second implementation, so a product prices identically here and on the
 * catalogue page (the UAT fix this was built for was explicit: "no separate
 * pricing logic was introduced").
 */
export function BestSellers({
  products,
  pricingConfig,
}: {
  products: StorefrontCatalogProduct[];
  pricingConfig: PricingConfigV2 | null;
}) {
  const items = products.filter((p) => p.isBestSeller && p.available).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <section className="section-pad">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-sp-3">
          <div className="max-w-[46ch]">
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
              Popular right now
            </p>
            <h2 className="font-display font-bold text-header leading-header m-0 text-balance">
              Best sellers, ready to customize
            </h2>
          </div>
          <Link
            href="/products?category=best-sellers"
            className="group inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-sm text-accent shrink-0"
          >
            View all best sellers
            <ArrowRight
              size={16}
              strokeWidth={2.25}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        <div className="mt-sp-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-sp-3">
          {items.map((product) => (
            <BestSellerCard
              key={product.id}
              product={product}
              pricingConfig={pricingConfig}
            />
          ))}
        </div>
      </Container>
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
  const priced = catalogCardPricing(product, pricingConfig, qty);
  const href = `/product/${encodeURIComponent(product.slug)}?id=${product.id}`;

  return (
    <article className="group border border-border rounded-lg bg-bg-raised overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover">
      <Link href={href} className="relative block aspect-[300/220] bg-bg-raised">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-fill-subtle-15" />
        )}
        <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-text-primary text-white">
          Best Seller
        </span>
      </Link>

      <div className="p-sp-3 flex flex-col flex-1">
        <p className="text-xs text-text-tertiary mb-1">{catalogCardSubtitle(product)}</p>
        <h3 className="font-display font-bold text-sm m-0 mb-1.5 line-clamp-2">
          {product.name}
        </h3>

        {product.colorSwatches.length > 0 && (
          <div className="flex items-center gap-1 mb-1.5">
            {product.colorSwatches.slice(0, 6).map((swatch, i) => {
              const fill = studioColorwayFill({
                id: swatch.productId,
                colorName: swatch.colorName,
                hex: swatch.colorHex ?? undefined,
                swatchImageUrl: swatch.imageUrl ?? undefined,
              });
              return (
                <span
                  key={`${swatch.colorName}-${i}`}
                  title={swatch.colorName}
                  className="w-4 h-4 rounded-full border border-border/60 shrink-0 overflow-hidden bg-bg"
                  style={fill.hex ? { backgroundColor: fill.hex } : undefined}
                >
                  {!fill.hex && fill.imageUrl && (
                    <Image
                      src={fill.imageUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="w-full h-full object-cover"
                    />
                  )}
                </span>
              );
            })}
            {product.colorwayCount > 6 && (
              <span className="text-[11px] text-text-tertiary ml-0.5">
                +{product.colorwayCount - 6}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-sp-3">
          <span className="font-bold text-text-primary text-sm">
            {priced.text.replace(/^from\s+/i, "From ")} each
          </span>
          {priced.isEstimate && (
            <PricingDetailsPopover
              quantityBreaks={priced.quantityBreaks}
              note={
                priced.methodLabel
                  ? `For a standard ${priced.methodLabel}, one location.`
                  : undefined
              }
            />
          )}
        </div>

        <div className="mt-auto pt-sp-3 border-t border-border flex gap-2">
          {/* Same two real entry points as the full catalogue card — see
              ProductsGrid.tsx's ProductCard for why this stays two actions
              rather than the mockup's single "Customize". */}
          <Link
            href={href}
            className="flex-1 text-center rounded-md border border-border py-2 text-sm font-bold hover:border-accent hover:text-accent transition-colors"
          >
            View Product
          </Link>
          <Link
            href={`/design?garmentId=${encodeURIComponent(product.id)}`}
            className="rounded-md bg-accent text-white px-3 py-2 text-sm font-bold hover:bg-accent-hover transition-colors"
          >
            Design
          </Link>
        </div>
      </div>
    </article>
  );
}
