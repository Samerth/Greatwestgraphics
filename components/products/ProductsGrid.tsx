"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { ArtTile } from "@/components/shared/ArtTile";
import { CATALOG, CATEGORIES, type Category } from "@/lib/data/products";
import { useActiveDesignStore, hasActiveArtwork } from "@/lib/store/active-design";
import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "@/lib/commerce/catalog";

type SortKey = "popular" | "price-asc" | "new";

const SIZE_CLASSES: Record<string, string> = {
  hero: "col-span-6 md:col-span-7 row-span-2",
  tall: "col-span-6 md:col-span-5 row-span-2",
  wide: "col-span-6",
  sq: "col-span-3 md:col-span-4",
};

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
  const [hovered, setHovered] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(activeBrands);
  const [priceMinInput, setPriceMinInput] = useState(
    activePriceMinMinor != null ? String(activePriceMinMinor / 100) : "",
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    activePriceMaxMinor != null ? String(activePriceMaxMinor / 100) : "",
  );
  const activeFilterCount =
    selectedBrands.length + (priceMinInput ? 1 : 0) + (priceMaxInput ? 1 : 0);

  function navigate(next: {
    category?: string;
    brands?: string[];
    priceMin?: string;
    priceMax?: string;
  }) {
    const category = next.category !== undefined ? next.category : activeCategory;
    const brands = next.brands !== undefined ? next.brands : selectedBrands;
    const priceMin = next.priceMin !== undefined ? next.priceMin : priceMinInput;
    const priceMax = next.priceMax !== undefined ? next.priceMax : priceMaxInput;
    const params = new URLSearchParams();
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
      } else if (sort === "new") {
        list.reverse();
      }
      return list.map((p) => ({
        kind: "db" as const,
        key: p.id,
        href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
        name: p.name,
        sub: `${p.colorName}${p.available ? "" : " · Unavailable"}`,
        priceFrom: p.priceFrom,
        imageUrl: p.imageUrl,
        available: p.available,
        // Real product photos aren't art-directed for a bento layout the
        // way the static demo catalog's curated `size` field is — cycling
        // through hero/tall/wide/sq made real garments render at random,
        // mismatched sizes. A single uniform size keeps the grid even.
        size: "sq" as const,
      }));
    }

    let list =
      activeCategory === "All"
        ? CATALOG
        : CATALOG.filter((t) => t.category === activeCategory);

    if (sort === "price-asc") {
      list = [...list].sort((a, b) => {
        const parse = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
        return parse(a.priceFrom) - parse(b.priceFrom);
      });
    } else if (sort === "new") {
      list = [...list].reverse();
    }
    return list.map((tile) => ({
      kind: "static" as const,
      key: tile.slug,
      href: `/product/${tile.slug}`,
      name: tile.name,
      sub: tile.sub,
      priceFrom: tile.priceFrom,
      artIndex: tile.artIndex,
      tags: tile.tags,
      size: tile.size,
      available: true,
    }));
  }, [activeCategory, sort, useDb, dbProducts]);

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-sp-3 mb-sp-5">
        <div className="flex flex-wrap gap-2">
          <Chip
            active={activeCategory === "All"}
            onClick={() => {
              setActiveCategory("All");
              if (useDb) navigate({ category: "All" });
            }}
          >
            All
          </Chip>
          {useDb
            ? dbCategories.map((c) => (
                <Chip
                  key={c.id}
                  active={activeCategory === c.slug}
                  onClick={() => {
                    setActiveCategory(c.slug);
                    navigate({ category: c.slug });
                  }}
                >
                  {c.name}
                </Chip>
              ))
            : CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  active={activeCategory === c}
                  onClick={() => setActiveCategory(c)}
                >
                  {c}
                </Chip>
              ))}
        </div>
        <div className="flex items-center gap-2">
          {useDb && dbBrands.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "border rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
                  activeFilterCount > 0
                    ? "border-accent text-accent bg-accent-tint"
                    : "border-border bg-bg-raised hover:border-text-tertiary",
                )}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full mt-2 w-[280px] rounded-lg border border-border bg-bg shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-sp-4 z-20">
                  <div className="mb-sp-3">
                    <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                      Price range
                    </span>
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
                  </div>

                  <div className="mb-sp-3">
                    <span className="block text-xs font-bold uppercase tracking-[0.1em] text-text-tertiary mb-2">
                      Brand
                    </span>
                    <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                      {dbBrands.map((brand) => (
                        <label
                          key={brand}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={(e) => {
                              setSelectedBrands((prev) =>
                                e.target.checked
                                  ? [...prev, brand]
                                  : prev.filter((b) => b !== brand),
                              );
                            }}
                          />
                          {brand}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBrands([]);
                        setPriceMinInput("");
                        setPriceMaxInput("");
                        navigate({ brands: [], priceMin: "", priceMax: "" });
                        setFiltersOpen(false);
                      }}
                      className="flex-1 rounded-sm border border-border py-2 text-xs font-bold hover:border-text-tertiary transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate({});
                        setFiltersOpen(false);
                      }}
                      className="flex-1 rounded-sm bg-accent text-white py-2 text-xs font-bold hover:bg-accent-hover transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-border rounded-sm bg-bg-raised px-3 py-2 text-sm font-semibold"
          >
            <option value="popular">Most popular</option>
            <option value="price-asc">Price: low to high</option>
            <option value="new">New arrivals</option>
          </select>
        </div>
      </div>

      {useDb && tiles.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-raised px-sp-5 py-sp-8 text-center">
          <p className="font-display text-[19px] mb-sp-2">
            Nothing here yet.
          </p>
          <p className="text-text-secondary max-w-[48ch] mx-auto mb-sp-4">
            We don&apos;t have live inventory in this category right now.
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
      <div
        className="grid grid-cols-6 md:grid-cols-12 auto-rows-[200px] md:auto-rows-[240px] gap-sp-3"
        onMouseLeave={() => setHovered(null)}
      >
        <AnimatePresence mode="popLayout">
          {tiles.map((tile) => {
            const isDimmed = hovered !== null && hovered !== tile.key;
            const isHovered = hovered === tile.key;

            return (
              <motion.div
                key={tile.key}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{
                  opacity: isDimmed ? 0.4 : 1,
                  scale: isHovered ? 1.015 : 1,
                }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.16, 0.8, 0.3, 1] }}
                onMouseEnter={() => setHovered(tile.key)}
                className={SIZE_CLASSES[tile.size]}
              >
                <Link
                  href={tile.href}
                  className={cn(
                    "relative block w-full h-full rounded-lg overflow-hidden border border-border bg-bg-raised group",
                    !tile.available && "opacity-80",
                  )}
                >
                  {tile.kind === "db" && tile.imageUrl ? (
                    <div className="absolute inset-0 bg-bg-raised">
                      <div className="absolute inset-3 sm:inset-5">
                        <Image
                          src={tile.imageUrl}
                          alt={tile.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      </div>
                    </div>
                  ) : tile.kind === "static" ? (
                    <ArtTile artIndex={tile.artIndex} alt={tile.name} />
                  ) : (
                    <div className="absolute inset-0 bg-fill-subtle-15" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,.65)_100%)] z-[1]" />

                  {tile.kind === "static" && (
                    <div className="absolute top-3.5 left-3.5 flex gap-1.5 z-[2]">
                      {tile.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={cn(
                            "text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full border",
                            tag.primary
                              ? "bg-accent border-accent text-white"
                              : "bg-white/90 border-border text-text-primary",
                          )}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {!tile.available && (
                    <div className="absolute top-3.5 left-3.5 z-[2]">
                      <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full border bg-amber-100 border-amber-300 text-amber-900">
                        Unavailable
                      </span>
                    </div>
                  )}

                  {tile.kind === "db" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/design?garmentId=${encodeURIComponent(tile.key)}`);
                      }}
                      className={cn(
                        "absolute top-3.5 right-3.5 z-[2] text-[11px] font-bold tracking-wide px-2.5 py-1.5 rounded-full transition-all",
                        hasDesign
                          ? "bg-accent text-white hover:bg-accent-hover"
                          : "bg-white/85 text-text-primary opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 hover:bg-white",
                      )}
                    >
                      {hasDesign ? "Preview my design" : "Design this →"}
                    </button>
                  )}

                  <div className="absolute left-4 right-4 bottom-3.5 z-[2]">
                    <h4 className="font-display text-white text-[19px] mb-1 [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
                      {tile.name}
                    </h4>
                    {tile.sub && (
                      <p className="text-white/85 text-[12.5px] [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
                        {tile.sub}
                      </p>
                    )}
                  </div>

                  <div className="absolute right-4 bottom-3.5 z-[2] bg-bg-raised text-text-primary text-xs font-bold px-2.5 py-1.5 rounded-sm">
                    {tile.priceFrom}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}
    </>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-accent border-accent text-white"
          : "bg-transparent border-border text-text-primary hover:border-text-tertiary",
      )}
    >
      {children}
    </button>
  );
}
