"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ArtTile } from "@/components/shared/ArtTile";
import { CATALOG, CATEGORIES, type Category } from "@/lib/data/products";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "@/lib/commerce/catalog";

type SortKey = "popular" | "price-asc" | "price-desc" | "new";

const FEATURE_FILTERS = [
  "Reinforced Seams",
  "Eco-Friendly Materials",
  "Made in Canada",
  "Fade-Resistant Print",
  "Quick Order Ready",
];

const COLOUR_SWATCHES = [
  "#0D0D0D",
  "#FFFFFF",
  "#132A66",
  "#AA3300",
  "#2d4a38",
  "#a8a8ac",
];

type Props = {
  initialCategory?: Category | "All" | string;
  dbProducts?: StorefrontCatalogProduct[];
  dbCategories?: StorefrontCategory[];
  dbBrands?: string[];
  preferDb?: boolean;
  activeCategorySlug?: string | null;
  activeBrands?: string[];
  activePriceMinMinor?: number | null;
  activePriceMaxMinor?: number | null;
  activeSearch?: string | null;
};

export function ProductsGrid({
  initialCategory = "All",
  dbProducts = [],
  dbCategories = [],
  dbBrands = [],
  preferDb = false,
  activeCategorySlug = null,
  activeBrands = [],
  activePriceMinMinor = null,
  activePriceMaxMinor = null,
  activeSearch = null,
}: Props) {
  const useDb = preferDb;
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeArtworks = useActiveDesignStore((s) => s.artworksBySide);
  const hasDesign = mounted && hasActiveArtwork(activeArtworks);
  const [activeCategory, setActiveCategory] = useState<string>(
    useDb
      ? activeCategorySlug || "All"
      : initialCategory === "All"
        ? "All"
        : String(initialCategory),
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
  const [featureFilters, setFeatureFilters] = useState<string[]>([]);

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

  const tiles = useMemo(() => {
    if (useDb) {
      let list = [...dbProducts];
      if (sort === "price-asc") {
        list.sort((a, b) => a.retailMinor - b.retailMinor);
      } else if (sort === "price-desc") {
        list.sort((a, b) => b.retailMinor - a.retailMinor);
      } else if (sort === "new") {
        list.reverse();
      }
      return list.map((p, index) => ({
        kind: "db" as const,
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
    }

    let list =
      activeCategory === "All"
        ? CATALOG
        : CATALOG.filter((t) => t.category === activeCategory);

    const parsePrice = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    if (sort === "price-asc") {
      list = [...list].sort((a, b) => parsePrice(a.priceFrom) - parsePrice(b.priceFrom));
    } else if (sort === "price-desc") {
      list = [...list].sort((a, b) => parsePrice(b.priceFrom) - parsePrice(a.priceFrom));
    } else if (sort === "new") {
      list = [...list].reverse();
    }
    return list.map((tile) => ({
      kind: "static" as const,
      key: tile.slug,
      href: `/product/${tile.slug}`,
      name: tile.name,
      brandName: tile.category,
      styleName: tile.sub,
      colorName: "",
      priceFrom: tile.priceFrom,
      artIndex: tile.artIndex,
      tags: tile.tags,
      available: true,
      bestSeller: tile.tags.some((t) => /best/i.test(t.label)),
    }));
  }, [activeCategory, sort, useDb, dbProducts]);

  const sidebar = (
    <aside className="space-y-sp-5">
      {useDb && (
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
      )}

      <FacetGroup title="Product Category">
        <FacetCheck
          label="All products"
          checked={activeCategory === "All"}
          onChange={() => {
            setActiveCategory("All");
            if (useDb) navigate({ category: "All" });
          }}
        />
        {(useDb ? dbCategories : CATEGORIES.map((c) => ({ id: c, slug: c, name: c }))).map(
          (c) => (
            <FacetCheck
              key={"slug" in c ? c.slug : c}
              label={"name" in c ? c.name : String(c)}
              checked={activeCategory === ("slug" in c ? c.slug : c)}
              onChange={() => {
                const slug = "slug" in c ? c.slug : String(c);
                setActiveCategory(slug);
                if (useDb) navigate({ category: slug });
                else setActiveCategory(slug);
              }}
            />
          ),
        )}
      </FacetGroup>

      <FacetGroup title="Colour">
        <div className="flex flex-wrap gap-2">
          {COLOUR_SWATCHES.map((hex) => (
            <span
              key={hex}
              title={hex}
              className="w-6 h-6 rounded-full border border-border"
              style={{ background: hex }}
            />
          ))}
        </div>
        <p className="text-xs text-text-tertiary m-0 mt-2">
          Colour filters refine on the product page after you pick a style.
        </p>
      </FacetGroup>

      {useDb && dbBrands.length > 0 && (
        <FacetGroup title="Brand">
          <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
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

      {useDb && (
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
      )}

      <FacetGroup title="Highlighted Features">
        {FEATURE_FILTERS.map((feature) => (
          <FacetCheck
            key={feature}
            label={feature}
            checked={featureFilters.includes(feature)}
            onChange={() =>
              setFeatureFilters((prev) =>
                prev.includes(feature)
                  ? prev.filter((f) => f !== feature)
                  : [...prev, feature],
              )
            }
          />
        ))}
      </FacetGroup>

      {useDb && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedBrands([]);
              setPriceMinInput("");
              setPriceMaxInput("");
              setFeatureFilters([]);
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
      )}
    </aside>
  );

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] gap-sp-5 items-start">
      <div className="hidden lg:block sticky top-[100px]">{sidebar}</div>

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
            {tiles.length} product{tiles.length === 1 ? "" : "s"}
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

        {useDb && tiles.length === 0 ? (
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
                  {tile.kind === "db" && tile.imageUrl ? (
                    <Image
                      src={tile.imageUrl}
                      alt={tile.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : tile.kind === "static" ? (
                    <ArtTile artIndex={tile.artIndex} alt={tile.name} />
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
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span
                      className="w-4 h-4 rounded-full border border-border bg-fill-subtle"
                      aria-hidden
                    />
                    <span>+ colours</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2 mb-1">
                    {tile.brandName}
                    {tile.colorName ? ` · ${tile.colorName}` : ""}
                  </p>
                  <h3 className="font-display font-bold text-[17px] m-0 leading-snug">
                    <Link href={tile.href} className="hover:text-accent transition-colors">
                      {tile.name}
                    </Link>
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-bold border border-border rounded-sm px-2 py-0.5">
                      S – 3XL
                    </span>
                    <span className="text-[11px] font-bold border border-border rounded-sm px-2 py-0.5">
                      Min. 24
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-2 mb-1">
                    {tile.available ? "3 Day Quick Order" : "Notify when back"}
                  </p>
                  <p className="font-bold text-sm m-0">{tile.priceFrom}</p>

                  <div className="mt-auto pt-sp-3 flex gap-2">
                    <Link
                      href={tile.href}
                      className="flex-1 text-center rounded-sm border border-border py-2 text-sm font-bold hover:border-accent hover:text-accent transition-colors"
                    >
                      View Product
                    </Link>
                    {tile.kind === "db" && tile.available && (
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
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded-sm border-border"
      />
      <span>{label}</span>
    </label>
  );
}
