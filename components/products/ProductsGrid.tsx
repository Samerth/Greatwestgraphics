"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { PricingConfigV2, QuoteInputV2 } from "@gwg/contracts";
import { calculateQuoteV2 } from "@gwg/pricing";
import { cn } from "@/lib/utils/cn";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "@/lib/commerce/catalog";
import { catalogCardSubtitle } from "@/lib/commerce/catalog-card";
import { publicQuoteOrFallback } from "@/lib/features";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { stitchCountForPreset } from "@/lib/utils/shop-quote";
import { useBrowsingQuantity } from "@/lib/store/browsing-quantity";
import { PricingDetailsPopover } from "@/components/shared/PricingDetailsPopover";

type CardQuantityBreak = { qty: number; unitMinor: number };

type CardPricing = {
  text: string;
  isEstimate: boolean;
  /** Same method's real quantity tiers, for the hover/click pricing-details
   * popup — empty whenever isEstimate is false (nothing to break down). */
  quantityBreaks: CardQuantityBreak[];
  methodLabel: string | null;
};

/**
 * Catalog card price at the customer's current browsing quantity, priced as
 * a real decorated estimate — 1-colour screen print for most products,
 * embroidery (small logo) for hats, since headwear is conventionally
 * embroidered rather than screen printed. Falls back to the server's blank
 * garment price whenever a decorated estimate can't be computed (no
 * published config, method disabled, no cost on file), rather than showing
 * nothing.
 */
function catalogCardPricing(
  product: StorefrontCatalogProduct,
  pricingConfig: PricingConfigV2 | null,
  qty: number,
): CardPricing {
  const empty: CardPricing = {
    text: product.priceFrom,
    isEstimate: false,
    quantityBreaks: [],
    methodLabel: null,
  };
  if (!product.available || !pricingConfig || !product.costMinor) return empty;
  const methodKey = product.isHat ? "embroidery" : "screenPrint";
  const method = pricingConfig.methods.find(
    (m) => m.key === methodKey && m.enabled,
  );
  if (!method) return empty;

  function inputAt(quantity: number): QuoteInputV2 {
    return {
      garments: [
        {
          id: "g1",
          description: product.name,
          unitCostMinor: product.costMinor,
          quantity,
          colourName: product.colorName,
          mapPriceMinor: product.mapPriceMinor ?? undefined,
        },
      ],
      decorations: [
        {
          id: "card-estimate",
          garmentId: "g1",
          methodKey,
          location: "front",
          logoGroup: "",
          colours: methodKey === "screenPrint" ? 1 : undefined,
          variableValue:
            methodKey === "embroidery" ? stitchCountForPreset("small") : undefined,
          isOversized: false,
          artwork: { isRepeat: false, verifiedByStaff: false },
        },
      ],
      options: {
        rush: false,
        includePacking: true,
        namesNumbers: false,
        shippingCostMinor: 0,
        designHours: 0,
      },
    };
  }

  try {
    const breakdown = calculateQuoteV2(inputAt(qty), pricingConfig);
    const unitMinor = Math.round(breakdown.totals.totalMinor / qty);
    const quantityBreaks = method.rateModel.qtyAnchors
      .map((anchorQty) => {
        try {
          const b = calculateQuoteV2(inputAt(anchorQty), pricingConfig);
          return { qty: anchorQty, unitMinor: Math.round(b.totals.totalMinor / anchorQty) };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is CardQuantityBreak => entry !== null);
    return {
      text: `from ${moneyFromMinor(unitMinor)}`,
      isEstimate: true,
      quantityBreaks,
      methodLabel: methodKey === "screenPrint" ? "1-colour screen print" : "small embroidery",
    };
  } catch {
    return empty;
  }
}

type SortKey = "popular" | "price-asc" | "price-desc" | "new";

// A "Highlighted Features" facet used to sit below Brand with five checkboxes
// — Reinforced Seams, Eco-Friendly Materials, Made in Canada, Fade-Resistant
// Print, Quick Order Ready. They looked identical to the Brand checkboxes
// beside them, but their state never reached `navigate()`, the URL or the
// grid, and the catalogue carries no attribute to filter them on. Ticking
// "Made in Canada" returned the whole catalogue and implied every result
// qualified. Reinstate this only alongside real per-product attribute data.


type ProductTile = {
  key: string;
  href: string;
  name: string;
  brandName: string;
  styleName: string;
  colorName: string;
  colorwayCount: number;
  colorSwatches: StorefrontCatalogProduct["colorSwatches"];
  sizeRange: string | null;
  priceFrom: string;
  /** Set only when priceFrom is a live decorated estimate (not the blank
   * fallback), so the card can show which quantity it's priced at. */
  priceQty: number | null;
  /** Real quantity-break pricing for the hover/click "i" popup — empty
   * when priceFrom is the blank fallback (nothing to break down). */
  quantityBreaks: CardQuantityBreak[];
  methodLabel: string | null;
  imageUrl: string | null;
  available: boolean;
  bestSeller: boolean;
};

type CategoryNode = StorefrontCategory & { children: StorefrontCategory[] };

function buildCategoryTree(categories: StorefrontCategory[]): CategoryNode[] {
  return categories
    .filter((c) => !c.parentId)
    .map((top) => ({
      ...top,
      children: categories.filter((c) => c.parentId === top.id),
    }));
}

type Props = {
  dbProducts?: StorefrontCatalogProduct[];
  dbCategories?: StorefrontCategory[];
  dbBrands?: string[];
  /** Full match count from the API, not the current page length. */
  resultTotal?: number;
  activeCategorySlug?: string | null;
  activeBrands?: string[];
  activePriceMinMinor?: number | null;
  activePriceMaxMinor?: number | null;
  activeSearch?: string | null;
  /** Published v2 pricing config, used to price cards as a real decorated
   * estimate at the customer's browsing quantity rather than a blank cost. */
  pricingConfig?: PricingConfigV2 | null;
};

export function ProductsGrid({
  dbProducts = [],
  dbCategories = [],
  dbBrands = [],
  resultTotal,
  activeCategorySlug = null,
  activeBrands = [],
  activePriceMinMinor = null,
  activePriceMaxMinor = null,
  activeSearch = null,
  pricingConfig = null,
}: Props) {
  const router = useRouter();
  // The quantity the customer was last using on any product's Live
  // Estimate Calculator (or set directly below) — shared and persisted so
  // catalog prices reflect how many units they actually need, not a fixed
  // assumption (CodSphere UAT V2).
  const qty = useBrowsingQuantity((s) => s.qty);
  const setQty = useBrowsingQuantity((s) => s.setQty);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeDesign = useActiveDesignStore((s) => s.design);
  const hasDesign = mounted && hasActiveArtwork(activeDesign);
  const [activeCategory, setActiveCategory] = useState<string>(
    activeCategorySlug || "All",
  );
  const [sort, setSort] = useState<SortKey>("popular");
  const [selectedBrands, setSelectedBrands] = useState<string[]>(activeBrands);
  const [priceMinInput, setPriceMinInput] = useState(
    activePriceMinMinor != null ? String(activePriceMinMinor / 100) : "",
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    activePriceMaxMinor != null ? String(activePriceMaxMinor / 100) : "",
  );
  const [searchInput, setSearchInput] = useState(activeSearch ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(true);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const categoryTree = useMemo(() => buildCategoryTree(dbCategories), [dbCategories]);
  // Showing every department (Bags, Accessories, Hoodies...) while already
  // browsing a specific one (e.g. Short Sleeve) buries the sibling
  // categories a shopper actually wants under unrelated ones. Once a
  // category is active, narrow the sidebar down to just its department.
  const activeGroup = useMemo(() => {
    if (activeCategory === "All") return null;
    const matchesSlug = (slug: string) => slug.toLowerCase() === activeCategory.toLowerCase();
    return (
      categoryTree.find((group) => matchesSlug(group.slug)) ??
      categoryTree.find((group) => group.children.some((child) => matchesSlug(child.slug))) ??
      null
    );
  }, [activeCategory, categoryTree]);
  const visibleGroups = activeGroup ? [activeGroup] : categoryTree;
  const BRAND_PREVIEW_COUNT = 8;
  const visibleBrands = showAllBrands
    ? dbBrands
    : dbBrands.slice(0, BRAND_PREVIEW_COUNT);

  function navigate(next: {
    category?: string;
    brands?: string[];
    priceMin?: string;
    priceMax?: string;
    search?: string;
  }) {
    const category = next.category !== undefined ? next.category : activeCategory;
    const brands = next.brands !== undefined ? next.brands : selectedBrands;
    const priceMin = next.priceMin !== undefined ? next.priceMin : priceMinInput;
    const priceMax = next.priceMax !== undefined ? next.priceMax : priceMaxInput;
    const search = next.search !== undefined ? next.search : searchInput;
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (category && category !== "All") params.set("category", category);
    for (const brand of brands) params.append("brand", brand);
    if (priceMin) params.set("priceMin", String(Math.round(parseFloat(priceMin) * 100)));
    if (priceMax) params.set("priceMax", String(Math.round(parseFloat(priceMax) * 100)));
    const qs = params.toString();
    router.push(`/products${qs ? `?${qs}` : ""}`);
  }

  // There used to be a second branch here that rendered twelve hardcoded demo
  // products from lib/data/products.ts whenever the commerce API had failed,
  // complete with invented "from $9.20/pc" prices and links to slugs that only
  // existed in that fixture. An outage is now an outage: the page says so and
  // offers a quote or a phone call instead of a fake catalogue.
  const tiles = useMemo(() => {
    const list = [...dbProducts];
    if (sort === "price-asc") {
      list.sort((a, b) => a.retailMinor - b.retailMinor);
    } else if (sort === "price-desc") {
      list.sort((a, b) => b.retailMinor - a.retailMinor);
    } else if (sort === "new") {
      list.reverse();
    }
    return list.map((p) => {
      const priced = catalogCardPricing(p, pricingConfig, qty);
      return {
        key: p.id,
        href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
        name: p.name,
        brandName: p.brandName,
        styleName: p.styleName,
        colorName: p.colorName,
        colorwayCount: p.colorwayCount,
        colorSwatches: p.colorSwatches,
        sizeRange: p.sizeRange,
        priceFrom: priced.text,
        priceQty: priced.isEstimate ? qty : null,
        quantityBreaks: priced.quantityBreaks,
        methodLabel: priced.methodLabel,
        imageUrl: p.imageUrl,
        available: p.available,
        // Real category membership (admin-assigned), not list position — see
        // catalog-service.ts listProducts for the batched best-seller lookup.
        bestSeller: p.isBestSeller && p.available,
      };
    });
  }, [sort, dbProducts, pricingConfig, qty]);

  const sidebar = (
    <aside className="space-y-sp-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: searchInput });
          setMobileFiltersOpen(false);
        }}
      >
        <label htmlFor="catalog-search" className="sr-only">
          Search within category
        </label>
        <input
          id="catalog-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search within category"
          className="w-full min-h-11 border border-border rounded-sm bg-bg-raised px-3.5 py-2.5 text-base font-body text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </form>

      <FacetGroup title="Product Category">
        <div className="space-y-2.5">
          <FacetCheck
            label="All products"
            checked={activeCategory === "All"}
            onChange={() => {
              setActiveCategory("All");
              navigate({ category: "All" });
            }}
          />
          {visibleGroups.map((group) => (
            <div key={group.id}>
              <FacetCheck
                label={group.name}
                checked={activeCategory.toLowerCase() === group.slug.toLowerCase()}
                onChange={() => {
                  setActiveCategory(group.slug);
                  navigate({ category: group.slug });
                }}
                emphasize
              />
              {group.children.length > 0 && (
                <div className="pl-5 mt-0.5 space-y-0.5">
                  {group.children.map((child) => (
                    <FacetCheck
                      key={child.slug}
                      label={child.name}
                      checked={activeCategory.toLowerCase() === child.slug.toLowerCase()}
                      onChange={() => {
                        setActiveCategory(child.slug);
                        navigate({ category: child.slug });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </FacetGroup>

      {dbBrands.length > 0 && (
        <div className="border-t border-border pt-sp-4">
          <button
            type="button"
            onClick={() => setBrandsOpen((v) => !v)}
            aria-expanded={brandsOpen}
            className="w-full flex items-center justify-between gap-2 group"
          >
            <h3 className="font-display font-bold text-sm m-0 flex items-center gap-2">
              Brand
              {selectedBrands.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[11px] font-bold leading-none">
                  {selectedBrands.length}
                </span>
              )}
            </h3>
            <ChevronDown
              size={16}
              className={cn(
                "text-text-tertiary transition-transform duration-200 group-hover:text-text-secondary",
                brandsOpen && "rotate-180",
              )}
            />
          </button>

          {brandsOpen && (
            <div className="mt-sp-2.5 space-y-1.5">
              {visibleBrands.map((brand) => (
                <FacetCheck
                  key={brand}
                  label={brand}
                  checked={selectedBrands.includes(brand)}
                  onChange={() => {
                    setSelectedBrands((prev) =>
                      prev.includes(brand)
                        ? prev.filter((b) => b !== brand)
                        : [...prev, brand],
                    );
                  }}
                />
              ))}

              {dbBrands.length > BRAND_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllBrands((v) => !v)}
                  className="text-xs font-bold text-accent hover:text-accent-hover transition-colors pt-1"
                >
                  {showAllBrands
                    ? "Show less"
                    : `Show ${dbBrands.length - BRAND_PREVIEW_COUNT} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <FacetGroup title="Price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Min"
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
            className="w-full min-w-0 border border-border rounded-sm bg-bg-raised px-2.5 py-1.5 text-sm"
          />
          <span className="text-text-tertiary">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Max"
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
            className="w-full min-w-0 border border-border rounded-sm bg-bg-raised px-2.5 py-1.5 text-sm"
          />
        </div>
      </FacetGroup>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedBrands([]);
            setPriceMinInput("");
            setPriceMaxInput("");
            navigate({ brands: [], priceMin: "", priceMax: "" });
          }}
          className="flex-1 rounded-sm border border-border py-2 text-xs font-bold hover:border-text-tertiary transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({});
            setMobileFiltersOpen(false);
          }}
          className="flex-1 rounded-sm bg-accent text-white py-2 text-xs font-bold hover:bg-accent-hover transition-colors"
        >
          Apply
        </button>
      </div>
    </aside>
  );

  return (
    <div className="lg:grid lg:grid-cols-[264px_1fr] xl:grid-cols-[288px_1fr] gap-sp-5 items-start">
      <div className="hidden lg:block sticky top-[calc(var(--header-offset)+24px)] max-h-[calc(100vh-var(--header-offset)-40px)] overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {sidebar}
      </div>

      <div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-sp-4 sticky top-[var(--header-offset)] z-30 -mx-1 px-1 py-3 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 border-b border-border/70">
          <button
            type="button"
            className="lg:hidden rounded-sm border border-border px-3 py-2 text-sm font-bold"
            onClick={() => setMobileFiltersOpen((v) => !v)}
          >
            {mobileFiltersOpen ? "Hide filters" : "Show filters"}
          </button>
          <p className="text-sm text-text-secondary m-0">
            {(resultTotal ?? tiles.length).toLocaleString()} product
            {(resultTotal ?? tiles.length) === 1 ? "" : "s"}
            {activeCategorySlug ? (
              <>
                {" "}
                in{" "}
                <b className="text-text-primary">
                  {dbCategories.find((c) => c.slug === activeCategorySlug)?.name ??
                    activeCategorySlug}
                </b>
              </>
            ) : null}
            {activeSearch ? (
              <>
                {" "}
                for <b className="text-text-primary">{activeSearch}</b>
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-raised py-1 pl-3 pr-1.5">
            <label
              htmlFor="browse-qty"
              className="text-[13px] font-semibold text-text-secondary whitespace-nowrap"
            >
              Show prices at
            </label>
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty(qty - 1)}
                disabled={qty <= 1}
                className="h-8 w-8 grid place-items-center rounded-md font-bold text-text-secondary transition-colors hover:bg-fill-subtle-15 hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary"
              >
                −
              </button>
              <input
                id="browse-qty"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="w-12 h-8 bg-transparent text-center text-sm font-bold text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Quantity to price at"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty(qty + 1)}
                className="h-8 w-8 grid place-items-center rounded-md font-bold text-text-secondary transition-colors hover:bg-fill-subtle-15 hover:text-accent"
              >
                +
              </button>
            </div>
            <span className="text-[13px] font-semibold text-text-secondary whitespace-nowrap pr-1">
              pieces
            </span>
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-border rounded-sm bg-bg-raised px-3 py-2 text-sm font-semibold"
          >
            <option value="popular">Sort: Popular</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="new">New arrivals</option>
          </select>
        </div>

        {mobileFiltersOpen && (
          <div className="lg:hidden mb-sp-4 border border-border rounded-md p-sp-3 bg-bg-raised">
            {sidebar}
          </div>
        )}

        {tiles.length === 0 ? (
          <div className="rounded-md border border-border bg-bg-raised px-sp-5 py-sp-8 text-center">
            <p className="font-display text-[19px] mb-sp-2">Nothing here yet.</p>
            <p className="text-text-secondary max-w-[48ch] mx-auto mb-sp-4">
              We don&apos;t have live inventory matching these filters right now.
              Reach out and we&apos;ll source it for you.
            </p>
            <Link
              href={publicQuoteOrFallback("/contact")}
              className="inline-block rounded-md bg-accent text-white font-bold text-sm px-4 py-2.5 hover:bg-accent-hover transition-colors"
            >
              Ask us to source it
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-sp-3">
            {tiles.map((tile) => (
              <ProductCard key={tile.key} tile={tile} hasDesign={hasDesign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function ProductCard({
  tile,
  hasDesign,
}: {
  tile: ProductTile;
  hasDesign: boolean;
}) {
  const router = useRouter();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const activeIdx = hoveredIdx ?? selectedIdx;
  const activeSwatch =
    activeIdx != null ? tile.colorSwatches[activeIdx] : undefined;

  const displayImageUrl = activeSwatch?.imageUrl || tile.imageUrl;
  const displayHref =
    activeSwatch?.productId && activeSwatch?.slug
      ? `/product/${encodeURIComponent(activeSwatch.slug)}?id=${activeSwatch.productId}`
      : tile.href;
  const designProductId = activeSwatch?.productId || tile.key;

  return (
    <article
      className={cn(
        "group border border-border rounded-lg bg-bg-raised overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover",
        !tile.available && "opacity-90",
      )}
    >
      <Link href={displayHref} className="relative block aspect-[300/220] bg-bg-raised">
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={activeSwatch ? `${tile.name} · ${activeSwatch.colorName}` : tile.name}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, (max-width: 1536px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-fill-subtle-15" />
        )}
        {tile.bestSeller && tile.available && (
          <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-accent text-white">
            Best Seller
          </span>
        )}
        {!tile.available && (
          <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm bg-amber-100 border border-amber-300 text-amber-900">
            Out of Stock
          </span>
        )}
      </Link>

      <div className="p-sp-3 flex flex-col flex-1">
        <p className="text-xs text-text-tertiary mb-1">
          {catalogCardSubtitle(tile)}
        </p>

        {tile.colorSwatches.length > 0 && (
          <div className="flex items-center gap-1 mb-1.5" onMouseLeave={() => setHoveredIdx(null)}>
            {tile.colorSwatches.slice(0, 7).map((swatch, i) => (
              <button
                key={`${swatch.colorName}-${i}`}
                type="button"
                title={swatch.colorName}
                aria-label={`View in ${swatch.colorName}`}
                aria-pressed={selectedIdx === i}
                onMouseEnter={() => setHoveredIdx(i)}
                onFocus={() => setHoveredIdx(i)}
                onBlur={() => setHoveredIdx(null)}
                onClick={() =>
                  setSelectedIdx((current) => (current === i ? null : i))
                }
                className={cn(
                  "relative w-4 h-4 rounded-full border overflow-hidden bg-bg shrink-0 transition-shadow",
                  activeIdx === i
                    ? "border-accent ring-2 ring-accent ring-offset-1"
                    : "border-border hover:border-accent",
                )}
              >
                {swatch.imageUrl && (
                  <Image
                    src={swatch.imageUrl}
                    alt={swatch.colorName}
                    fill
                    className="object-cover"
                    sizes="16px"
                  />
                )}
              </button>
            ))}
            {tile.colorwayCount > 7 && (
              <span className="text-[11px] text-text-tertiary ml-0.5">
                +{tile.colorwayCount - 7}
              </span>
            )}
          </div>
        )}

        <h3 className="font-display font-bold text-[17px] m-0 leading-snug">
          <Link href={displayHref} className="hover:text-accent transition-colors">
            {tile.name}
          </Link>
        </h3>
        <p className="text-xs text-text-secondary mt-2 mb-1">
          {tile.sizeRange ? `${tile.sizeRange} · ` : ""}
          {tile.available ? "3 Day Quick Order" : "Ask us for lead time"}
        </p>
        <p className="font-bold text-sm m-0 flex items-center gap-1.5">
          <span>
            {tile.priceFrom}
            {tile.priceQty != null && (
              <span className="font-normal text-text-tertiary">
                {" "}
                at {tile.priceQty.toLocaleString()} pcs
              </span>
            )}
          </span>
          {tile.quantityBreaks.length > 0 && (
            <PricingDetailsPopover
              quantityBreaks={tile.quantityBreaks}
              note={tile.methodLabel ? `For a standard ${tile.methodLabel}, one location.` : undefined}
            />
          )}
        </p>

        <div className="mt-auto pt-sp-3 flex gap-2">
          <Link
            href={displayHref}
            className="flex-1 text-center rounded-sm border border-border py-2 text-sm font-bold hover:border-accent hover:text-accent transition-colors"
          >
            View Product
          </Link>
          {tile.available && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/design?garmentId=${encodeURIComponent(designProductId)}`,
                )
              }
              className="rounded-sm bg-accent text-white px-3 py-2 text-sm font-bold hover:bg-accent-hover transition-colors"
              title={hasDesign ? "Preview my design" : "Design this"}
            >
              Design
            </button>
          )}
        </div>
      </div>
    </article>
  );
}


function FacetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display font-bold text-sm m-0 mb-sp-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FacetCheck({
  label,
  checked,
  onChange,
  emphasize = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  emphasize?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm rounded-sm px-1.5 py-1.5 -mx-1.5 cursor-pointer hover:bg-fill-subtle-15 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded-sm border-border accent-[color:var(--color-accent)] cursor-pointer"
      />
      <span
        className={cn(
          "leading-tight",
          checked || emphasize
            ? "font-bold text-text-primary"
            : "text-text-secondary",
        )}
      >
        {label}
      </span>
    </label>
  );
}
