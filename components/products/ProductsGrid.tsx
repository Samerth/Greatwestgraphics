"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "@/lib/commerce/catalog";

type SortKey = "popular" | "price-asc" | "price-desc" | "new";

// A "Highlighted Features" facet used to sit below Brand with five checkboxes
// — Reinforced Seams, Eco-Friendly Materials, Made in Canada, Fade-Resistant
// Print, Quick Order Ready. They looked identical to the Brand checkboxes
// beside them, but their state never reached `navigate()`, the URL or the
// grid, and the catalogue carries no attribute to filter them on. Ticking
// "Made in Canada" returned the whole catalogue and implied every result
// qualified. Reinstate this only alongside real per-product attribute data.


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
}: Props) {
  const router = useRouter();
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
  const categoryTree = useMemo(() => buildCategoryTree(dbCategories), [dbCategories]);

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
    return list.map((p, index) => ({
      key: p.id,
      href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
      name: p.name,
      brandName: p.brandName,
      styleName: p.styleName,
      colorName: p.colorName,
      priceFrom: p.priceFrom,
      imageUrl: p.imageUrl,
      available: p.available,
      bestSeller: index < 3 && p.available,
    }));
  }, [sort, dbProducts]);

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
          {categoryTree.map((group) => (
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
        <FacetGroup title="Brand">
          <div className="space-y-1.5">
            {dbBrands.map((brand) => (
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
          </div>
        </FacetGroup>
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
    <div className="lg:grid lg:grid-cols-[280px_1fr] gap-sp-5 items-start">
      <div className="hidden lg:block sticky top-[calc(var(--header-offset)+24px)] max-h-[calc(100vh-var(--header-offset)-40px)] overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {sidebar}
      </div>

      <div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-sp-4">
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
              Reach out for a custom quote and we&apos;ll source it for you.
            </p>
            <Link
              href="/quote"
              className="inline-block rounded-md bg-accent text-white font-bold text-sm px-4 py-2.5 hover:bg-accent-hover transition-colors"
            >
              Request a Custom Quote
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">
            {tiles.map((tile) => (
              <article
                key={tile.key}
                className={cn(
                  "border border-border rounded-md bg-bg-raised overflow-hidden flex flex-col",
                  !tile.available && "opacity-90",
                )}
              >
                <Link href={tile.href} className="relative block aspect-[300/220] bg-bg">
                  {tile.imageUrl ? (
                    <Image
                      src={tile.imageUrl}
                      alt={tile.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 33vw"
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

                {/* Three fixtures used to sit in this card and were rendered
                    identically on all ten thousand of them: an empty grey
                    swatch labelled "+ colours" with no count behind it, and
                    "S – 3XL" / "Min. 24" size and minimum badges. The size
                    range was wrong for every cap, tote and banner in the
                    catalogue, and "Min. 24" contradicted the minimum the
                    quote builder actually enforces, which is 12. Real size
                    ranges and colourway counts exist on the style record but
                    are not carried on the listing payload, so showing them
                    here needs a contract change rather than a literal. */}
                <div className="p-sp-3 flex flex-col flex-1">
                  <p className="text-xs text-text-tertiary mb-1">
                    {tile.brandName}
                    {tile.colorName ? ` · ${tile.colorName}` : ""}
                  </p>
                  <h3 className="font-display font-bold text-[17px] m-0 leading-snug">
                    <Link href={tile.href} className="hover:text-accent transition-colors">
                      {tile.name}
                    </Link>
                  </h3>
                  {/* Said "Notify when back", which we cannot do — there is no
                      back-in-stock subscription anywhere in the system. */}
                  <p className="text-xs text-text-secondary mt-2 mb-1">
                    {tile.available ? "3 Day Quick Order" : "Ask us for lead time"}
                  </p>
                  <p className="font-bold text-sm m-0">{tile.priceFrom}</p>

                  <div className="mt-auto pt-sp-3 flex gap-2">
                    <Link
                      href={tile.href}
                      className="flex-1 text-center rounded-sm border border-border py-2 text-sm font-bold hover:border-accent hover:text-accent transition-colors"
                    >
                      View Product
                    </Link>
                    {tile.available && (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/design?garmentId=${encodeURIComponent(tile.key)}`,
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
            ))}
          </div>
        )}
      </div>
    </div>
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
